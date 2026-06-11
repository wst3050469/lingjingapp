/**
 * 企业微信 (WeChat Work) 回调模块
 * 处理企业微信服务器的URL验证和消息回调
 */

import { createDecipheriv, createCipheriv, createHash, randomBytes } from 'node:crypto';

// 从 base64 解码 AESKey（43位 base64 → 32字节 AES 密钥）
function decodeAESKey(encodingAESKey) {
  const key = Buffer.from(encodingAESKey + '=', 'base64');
  if (key.length !== 32) {
    throw new Error(`AESKey length mismatch: expected 32 bytes, got ${key.length}`);
  }
  return key;
}

// PKCS7 解填充
function pkcs7Unpad(data) {
  const pad = data[data.length - 1];
  if (pad < 1 || pad > 32) {
    throw new Error('Invalid PKCS7 padding');
  }
  for (let i = data.length - pad; i < data.length; i++) {
    if (data[i] !== pad) {
      throw new Error('Invalid PKCS7 padding bytes');
    }
  }
  return data.subarray(0, data.length - pad);
}

// PKCS7 填充
function pkcs7Pad(data, blockSize) {
  const padLen = blockSize - (data.length % blockSize);
  const padBuf = Buffer.alloc(padLen, padLen);
  return Buffer.concat([data, padBuf]);
}

// 解密企业微信加密消息
function decryptMessage(encryptedBase64, encodingAESKey) {
  const aesKey = decodeAESKey(encodingAESKey);
  const iv = aesKey.subarray(0, 16);

  const decipher = createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);

  const encrypted = Buffer.from(encryptedBase64, 'base64');
  let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  decrypted = pkcs7Unpad(decrypted);

  // 格式: random(16 bytes) + msg_len(4 bytes network order) + msg_content + corp_id
  const msgLen = decrypted.readUInt32BE(16);
  const msgContent = decrypted.subarray(20, 20 + msgLen).toString('utf-8');
  const corpId = decrypted.subarray(20 + msgLen).toString('utf-8');

  return { message: msgContent, corpId };
}

// 加密消息（用于回复企业微信）
function encryptMessage(xmlContent, encodingAESKey, corpId) {
  const aesKey = decodeAESKey(encodingAESKey);
  const iv = aesKey.subarray(0, 16);

  const random = randomBytes(16);
  const msgBuf = Buffer.from(xmlContent, 'utf-8');
  const msgLen = Buffer.alloc(4);
  msgLen.writeUInt32BE(msgBuf.length);

  const corpIdBuf = Buffer.from(corpId, 'utf-8');
  const plaintext = Buffer.concat([random, msgLen, msgBuf, corpIdBuf]);

  const padded = pkcs7Pad(plaintext, 32);
  const cipher = createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
}

// 签名计算: SHA1(sort(token, timestamp, nonce, ...))
function verifySignature(token, timestamp, nonce, ...args) {
  const arr = [token, timestamp, nonce, ...args].sort();
  const hash = createHash('sha1').update(arr.join('')).digest('hex');
  return hash;
}

/**
 * 处理 GET 请求（URL验证）
 * 企业微信服务器发送 GET 请求验证 URL 有效性
 */
export function handleVerifyURL(req, db, logger) {
  const { msg_signature, timestamp, nonce, echostr } = req.query;

  if (!msg_signature || !timestamp || !nonce || !echostr) {
    logger?.('[WECOM] Missing params in verify URL');
    return { status: 400, body: 'Missing required parameters' };
  }

  // 获取配置
  const config = db.prepare('SELECT * FROM wecom_config WHERE id = ?').get('default');
  if (!config || !config.token || !config.encoding_aes_key) {
    logger?.('[WECOM] No wecom config found');
    return { status: 500, body: 'WeCom not configured' };
  }

  const token = config.token;
  const aesKey = config.encoding_aes_key;

  // 验证签名
  const expectedSig = verifySignature(token, timestamp, nonce, echostr);
  if (expectedSig !== msg_signature) {
    logger?.('[WECOM] Signature mismatch');
    return { status: 403, body: 'Signature verification failed' };
  }

  // 解密 echostr
  try {
    const { message } = decryptMessage(echostr, aesKey);
    logger?.('[WECOM] URL verify success');
    return { status: 200, body: message };
  } catch (err) {
    logger?.(`[WECOM] Decrypt error: ${err.message}`);
    return { status: 500, body: 'Decryption failed: ' + err.message };
  }
}

/**
 * 处理 POST 请求（消息回调）
 */
export function handleCallback(req, res, db, logger) {
  const { msg_signature, timestamp, nonce } = req.query;

  if (!msg_signature || !timestamp || !nonce) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const config = db.prepare('SELECT * FROM wecom_config WHERE id = ?').get('default');
  if (!config || !config.token || !config.encoding_aes_key) {
    return res.status(500).json({ error: 'WeCom not configured' });
  }

  const token = config.token;
  const aesKey = config.encoding_aes_key;

  // 获取原始请求体（企业微信发的是 XML）
  let rawBody = '';
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString('utf-8');
  } else if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    rawBody = req.body.xml || JSON.stringify(req.body);
  }

  // 提取 Encrypt 字段
  // 提取 Encrypt 内容（支持 CDATA 或纯文本）
  const encryptCDATAMatch = rawBody.match(/<Encrypt><!\[CDATA\[([\s\S]*?)\]\]><\/Encrypt>/);
  const encryptPlainMatch = rawBody.match(/<Encrypt>([\s\S]*?)<\/Encrypt>/);
  const encryptMatch = encryptCDATAMatch || encryptPlainMatch;
  if (!encryptMatch) {
    return res.status(400).json({ error: 'No Encrypt field in request body' });
  }
  const encryptXml = encryptMatch[1].trim();

  // 验证签名
  const expectedSig = verifySignature(token, timestamp, nonce, encryptXml);
  if (expectedSig !== msg_signature) {
    logger?.('[WECOM] POST signature mismatch');
    return res.status(403).json({ error: 'Signature verification failed' });
  }

  // 解密消息
  try {
    const { message, corpId } = decryptMessage(encryptXml, aesKey);
    logger?.(`[WECOM] Received msg: ${message.slice(0, 200)}`);

    // 解析 XML 消息内容
    const msgType = message.match(/<MsgType>.*?<!\[CDATA\[(.*?)\]\]>.*?<\/MsgType>/) ||
                    message.match(/<MsgType>(.*?)<\/MsgType>/);
    const fromUser = message.match(/<FromUserName>.*?<!\[CDATA\[(.*?)\]\]>.*?<\/FromUserName>/) ||
                     message.match(/<FromUserName>(.*?)<\/FromUserName>/);
    const content = message.match(/<Content>.*?<!\[CDATA\[(.*?)\]\]>.*?<\/Content>/) ||
                    message.match(/<Content>(.*?)<\/Content>/);

    const msgTypeVal = msgType ? msgType[1] : 'unknown';
    const fromUserVal = fromUser ? fromUser[1] : 'unknown';
    const contentVal = content ? content[1] : '';

    logger?.(`[WECOM] Type: ${msgTypeVal}, From: ${fromUserVal}, Content: ${contentVal}`);

    // 转发到本地AI服务器进行存储和分析（异步，不阻塞回调）
    try {
        const fwdUrl = new URL("https://www.spiritrealmz.com/api/v1/wecom/callback");
        fwdUrl.searchParams.set("msg_signature", msg_signature);
        fwdUrl.searchParams.set("timestamp", timestamp);
        fwdUrl.searchParams.set("nonce", nonce);
        fetch(fwdUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/xml; charset=utf-8" },
            body: rawBody,
        }).then(fwdResp => {
            logger?.(`[WECOM] Forwarded to AI engine: ${fwdResp.status}`);
        }).catch(fwdErr => {
            logger?.(`[WECOM] Forward failed: ${fwdErr.message}`);
        });
    } catch (fwdErr) {
        logger?.(`[WECOM] Forward setup error: ${fwdErr.message}`);
    }

    // 返回 success（空字符串表示成功）
    res.set('Content-Type', 'text/plain');
    return res.status(200).send('success');
  } catch (err) {
    logger?.(`[WECOM] POST decrypt error: ${err.message}`);
    return res.status(500).json({ error: 'Decryption failed: ' + err.message });
  }
}

/**
 * 注册企业微信路由到 Express 应用
 */
export function registerWeComRoutes(app, db, logger) {
  // GET - URL 验证
  app.get('/api/v1/wecom/callback', (req, res) => {
    const result = handleVerifyURL(req, db, logger || console.log);
    res.status(result.status).send(result.body);
  });

  // POST - 消息回调
  app.post('/api/v1/wecom/callback', (req, res) => {
    handleCallback(req, res, db, logger || console.log);
  });

  // 获取配置信息（用于后台管理）
  app.get('/api/v1/wecom/config', (req, res) => {
    try {
      const config = db.prepare('SELECT * FROM wecom_config WHERE id = ?').get('default');
      if (!config) {
        return res.status(404).json({ error: 'not_configured' });
      }
      return res.json({
        corp_id: config.corp_id || '',
        agent_id: config.agent_id,
        token_set: !!config.token,
        aes_key_set: !!config.encoding_aes_key,
        secret_set: !!config.secret,
        updated_at: config.updated_at
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 更新配置
  app.put('/api/v1/wecom/config', (req, res) => {
    try {
      const { corp_id, agent_id, secret, token, encoding_aes_key } = req.body;
      const existing = db.prepare('SELECT * FROM wecom_config WHERE id = ?').get('default');
      if (existing) {
        db.prepare(`
          UPDATE wecom_config SET 
            corp_id = COALESCE(?, corp_id),
            agent_id = COALESCE(?, agent_id),
            secret = COALESCE(?, secret),
            token = COALESCE(?, token),
            encoding_aes_key = COALESCE(?, encoding_aes_key),
            updated_at = datetime('now')
          WHERE id = 'default'
        `).run(corp_id || null, agent_id || null, secret || null, token || null, encoding_aes_key || null);
      } else {
        db.prepare(`
          INSERT INTO wecom_config (id, corp_id, agent_id, secret, token, encoding_aes_key, updated_at)
          VALUES ('default', ?, ?, ?, ?, ?, datetime('now'))
        `).run(corp_id || '', agent_id || null, secret || '', token || '', encoding_aes_key || '');
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  logger?.('[WECOM] Routes registered');
}
