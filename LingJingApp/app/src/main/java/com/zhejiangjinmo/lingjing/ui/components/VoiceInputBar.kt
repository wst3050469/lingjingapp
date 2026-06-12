package com.zhejiangjinmo.lingjing.ui.components

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.delay
import java.io.File

enum class VoiceState { IDLE, RECORDING, DONE }

@Composable
fun VoiceInputBar(
    onVoiceResult: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var voiceState by remember { mutableStateOf(VoiceState.IDLE) }
    var recordDuration by remember { mutableIntStateOf(0) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var audioFile by remember { mutableStateOf<File?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            voiceState = VoiceState.RECORDING
            recordDuration = 0
            audioFile = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
            recorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(audioFile!!.absolutePath)
                prepare()
                start()
            }
        }
    }

    fun startRecording() {
        val perm = Manifest.permission.RECORD_AUDIO
        if (ContextCompat.checkSelfPermission(context, perm) == PackageManager.PERMISSION_GRANTED) {
            voiceState = VoiceState.RECORDING
            recordDuration = 0
        } else {
            permissionLauncher.launch(perm)
        }
    }

    fun stopRecording() {
        try { recorder?.stop(); recorder?.release() } catch (_: Exception) {}
        recorder = null
        voiceState = VoiceState.DONE
    }

    fun cancelRecording() {
        try { recorder?.stop(); recorder?.release() } catch (_: Exception) {}
        recorder = null
        audioFile?.delete()
        audioFile = null
        voiceState = VoiceState.IDLE
    }

    // Duration timer
    LaunchedEffect(voiceState) {
        if (voiceState == VoiceState.RECORDING) {
            recordDuration = 0
            while (voiceState == VoiceState.RECORDING) {
                delay(1000)
                recordDuration++
            }
        }
    }

    val bgColor by animateColorAsState(
        when (voiceState) {
            VoiceState.IDLE -> DarkSurface
            VoiceState.RECORDING -> DangerRed.copy(alpha = 0.15f)
            VoiceState.DONE -> SuccessGreen.copy(alpha = 0.15f)
        }
    )

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = bgColor,
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            when (voiceState) {
                VoiceState.IDLE -> {
                    IconButton(onClick = { startRecording() }) {
                        Icon(Icons.Filled.Mic, "开始录音", tint = DarkTextSecondary, modifier = Modifier.size(24.dp))
                    }
                    Text("点击开始语音输入", color = DarkTextTertiary, fontSize = 14.sp, modifier = Modifier.weight(1f))
                }
                VoiceState.RECORDING -> {
                    // Pulsing indicator
                    Box(
                        modifier = Modifier.size(12.dp).clip(CircleShape).background(DangerRed)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        "录音中 ${recordDuration}s",
                        color = DangerRed,
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { cancelRecording() }) {
                        Icon(Icons.Filled.Close, "取消", tint = DarkTextSecondary)
                    }
                    IconButton(onClick = { stopRecording() }) {
                        Icon(Icons.Filled.Done, "完成", tint = SuccessGreen)
                    }
                }
                VoiceState.DONE -> {
                    Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("录音完成", color = SuccessGreen, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = {
                        onVoiceResult("[语音输入: ${recordDuration}秒录音]")
                        voiceState = VoiceState.IDLE
                    }) { Text("发送") }
                    IconButton(onClick = { voiceState = VoiceState.IDLE }) {
                        Icon(Icons.Filled.Refresh, "重新", tint = DarkTextSecondary)
                    }
                }
            }
        }
    }
}
