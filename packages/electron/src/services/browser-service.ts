import type { Browser, BrowserContext, Page } from 'playwright';

// Lazy-load playwright at runtime to avoid crashing the main process
// when playwright is not installed in the packaged app.
let _playwright: typeof import('playwright') | null = null;

async function getPlaywright(): Promise<typeof import('playwright')> {
  if (!_playwright) {
    _playwright = await import('playwright');
  }
  return _playwright;
}

export interface BrowserSessionState {
  status: 'closed' | 'ready' | 'navigated' | 'active' | 'shutdown';
  currentUrl: string | null;
  pageTitle: string | null;
  lastScreenshot: string | null;
  lastActivity: number;
}

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface LinkInfo {
  text: string;
  url: string;
}

export interface PageInfo {
  url: string;
  title: string;
  statusCode?: number;
}

export type BrowserOperation =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'scroll'
  | 'screenshot'
  | 'extractText'
  | 'extractLinks'
  | 'extractTable'
  | 'goBack'
  | 'goForward'
  | 'pressKey'
  | 'wait'
  | 'getPageInfo'
  | 'close';

export interface BrowserOperationResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  error?: string;
}

let _browserService: BrowserService | null = null;

export function getBrowserService(): BrowserService {
  if (!_browserService) {
    _browserService = new BrowserService();
  }
  return _browserService;
}

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private currentPage: Page | null = null;
  private state: BrowserSessionState = {
    status: 'closed',
    currentUrl: null,
    pageTitle: null,
    lastScreenshot: null,
    lastActivity: Date.now(),
  };

  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    try {
      const { chromium } = await getPlaywright();
      this.browser = await chromium.launch({
        channel: process.env.CODEPILOT_BROWSER_CHANNEL || 'chrome',
        headless: false,
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      this.currentPage = await this.context.newPage();
      this.state.status = 'ready';
      this.state.lastActivity = Date.now();
    } catch (error) {
      this.state.status = 'closed';
      throw new Error(
        `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.currentPage = null;
      this.state = {
        status: 'shutdown',
        currentUrl: null,
        pageTitle: null,
        lastScreenshot: null,
        lastActivity: Date.now(),
      };
    }
  }

  getState(): BrowserSessionState {
    return { ...this.state };
  }

  private ensureBrowser(): Page {
    if (!this.currentPage) {
      throw new Error('Browser not initialized. Use /browser command first.');
    }
    return this.currentPage;
  }

  async execute(
    operation: BrowserOperation,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    try {
      const result = await this.executeOperation(operation, params, signal);
      this.state.lastActivity = Date.now();
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: msg,
      };
    }
  }

  private async executeOperation(
    operation: BrowserOperation,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    switch (operation) {
      case 'navigate':
        return this.navigate(params, signal);
      case 'click':
        return this.click(params, signal);
      case 'type':
        return this.type(params, signal);
      case 'select':
        return this.select(params, signal);
      case 'scroll':
        return this.scroll(params, signal);
      case 'screenshot':
        return this.screenshot(params, signal);
      case 'extractText':
        return this.extractText(params, signal);
      case 'extractLinks':
        return this.extractLinks(params, signal);
      case 'extractTable':
        return this.extractTable(params, signal);
      case 'goBack':
        return this.goBack(signal);
      case 'goForward':
        return this.goForward(signal);
      case 'pressKey':
        return this.pressKey(params, signal);
      case 'wait':
        return this.wait(params, signal);
      case 'getPageInfo':
        return this.getPageInfo(signal);
      case 'close':
        return this.close(params, signal);
      default:
        throw new Error(`Unknown browser operation: ${operation}`);
    }
  }

  private async navigate(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const url = params.url as string;
    const waitUntil = (params.waitUntil as 'load' | 'domcontentloaded' | 'networkidle') || 'load';
    const timeout = (params.timeout as number) || 30000;

    if (signal?.aborted) {
      throw new Error('Navigation aborted');
    }

    const response = await page.goto(url, { waitUntil, timeout });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    this.state.currentUrl = page.url();
    this.state.pageTitle = await page.title();
    this.state.status = 'navigated';

    return {
      success: true,
      data: {
        url: this.state.currentUrl,
        title: this.state.pageTitle,
        status: response?.status(),
      },
    };
  }

  private async click(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const selector = params.selector as string;
    const timeout = (params.timeout as number) || 10000;

    if (signal?.aborted) {
      throw new Error('Click aborted');
    }

    await page.click(selector, { timeout });
    this.state.status = 'active';

    return {
      success: true,
      data: { message: `Clicked: ${selector}` },
    };
  }

  private async type(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const selector = params.selector as string;
    const text = params.text as string;
    const clearFirst = (params.clearFirst as boolean) !== false;
    const pressEnter = params.pressEnter as boolean;
    const timeout = (params.timeout as number) || 10000;

    if (signal?.aborted) {
      throw new Error('Type aborted');
    }

    if (clearFirst) {
      await page.click(selector, { timeout });
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
    }

    await page.fill(selector, text, { timeout });

    if (pressEnter) {
      await page.keyboard.press('Enter');
    }

    this.state.status = 'active';

    return {
      success: true,
      data: { message: `Typed "${text}" into ${selector}` },
    };
  }

  private async select(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const selector = params.selector as string;
    const value = params.value as string;
    const timeout = (params.timeout as number) || 10000;

    if (signal?.aborted) {
      throw new Error('Select aborted');
    }

    await page.selectOption(selector, value, { timeout });
    this.state.status = 'active';

    return {
      success: true,
      data: { message: `Selected "${value}" in ${selector}` },
    };
  }

  private async scroll(
    params: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const direction = params.direction as string;
    const amount = (params.amount as number) || 500;

    await page.evaluate(
      ({ direction, amount }) => {
        if (direction === 'top') {
          window.scrollTo(0, 0);
        } else if (direction === 'bottom') {
          window.scrollTo(0, document.body.scrollHeight);
        } else if (direction === 'up') {
          window.scrollBy(0, -amount);
        } else if (direction === 'down') {
          window.scrollBy(0, amount);
        }
      },
      { direction, amount },
    );

    this.state.status = 'active';

    return {
      success: true,
      data: { message: `Scrolled ${direction}` },
    };
  }

  private async screenshot(
    params: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const fullPage = params.fullPage as boolean;
    const format = (params.format as 'png' | 'jpeg') || 'png';
    const quality = (params.quality as number) || 80;

    const buffer = await page.screenshot({
      fullPage: fullPage || false,
      type: format,
      quality: format === 'jpeg' ? quality : undefined,
    });

    const base64 = buffer.toString('base64');
    const dataUrl = `data:image/${format};base64,${base64}`;

    this.state.lastScreenshot = dataUrl;

    return {
      success: true,
      data: {
        format,
        size: buffer.length,
      },
      screenshot: dataUrl,
    };
  }

  private async extractText(
    params: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const selector = params.selector as string | undefined;
    const maxLength = (params.maxLength as number) || 10000;

    let text: string;
    if (selector) {
      text = await page.locator(selector).textContent() || '';
    } else {
      text = await page.evaluate(() => document.body.innerText);
    }

    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...(truncated)';
    }

    return {
      success: true,
      data: { text },
    };
  }

  private async extractLinks(
    params: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const selector = params.selector as string | undefined;
    const maxLinks = (params.maxLinks as number) || 50;

    const links: LinkInfo[] = await page.evaluate(
      (sel: string | undefined) => {
        const elements = sel
          ? Array.from(document.querySelectorAll(sel))
          : Array.from(document.querySelectorAll('a'));
        return elements
          .map((el) => ({
            text: (el.textContent || '').trim(),
            url: (el as HTMLAnchorElement).href,
          }))
          .filter((l) => l.text && l.url)
          .slice(0, 50);
      },
      selector,
    );

    return {
      success: true,
      data: { links: links.slice(0, maxLinks) },
    };
  }

  private async extractTable(
    params: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const selector = params.selector as string;

    if (!selector) {
      throw new Error('Selector is required for table extraction');
    }

    const markdown = await page.evaluate((sel: string) => {
      const table = document.querySelector(sel);
      if (!table) return null;

      const rows = Array.from(table.querySelectorAll('tr'));
      const markdownRows = rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return '| ' + cells.map((c) => (c.textContent || '').trim()).join(' | ') + ' |';
      });

      if (markdownRows.length === 0) return '';

      const headerRow = markdownRows[0];
      const separator = headerRow.replace(/[^|]/g, '-');
      markdownRows.splice(1, 0, separator);

      return markdownRows.join('\n');
    }, selector);

    if (!markdown) {
      throw new Error(`Table not found: ${selector}`);
    }

    return {
      success: true,
      data: { markdown },
    };
  }

  private async goBack(_signal?: AbortSignal): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    await page.goBack({ waitUntil: 'load' });
    this.state.currentUrl = page.url();
    this.state.pageTitle = await page.title();

    return {
      success: true,
      data: { url: this.state.currentUrl, title: this.state.pageTitle },
    };
  }

  private async goForward(_signal?: AbortSignal): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    await page.goForward({ waitUntil: 'load' });
    this.state.currentUrl = page.url();
    this.state.pageTitle = await page.title();

    return {
      success: true,
      data: { url: this.state.currentUrl, title: this.state.pageTitle },
    };
  }

  private async pressKey(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const key = params.key as string;

    if (signal?.aborted) {
      throw new Error('PressKey aborted');
    }

    await page.keyboard.press(key);
    this.state.status = 'active';

    return {
      success: true,
      data: { message: `Pressed key: ${key}` },
    };
  }

  private async wait(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const type = (params.type as 'timeout' | 'selector' | 'load') || 'timeout';
    const duration = (params.duration as number) || 1000;
    const selector = params.selector as string | undefined;

    if (signal?.aborted) {
      throw new Error('Wait aborted');
    }

    if (type === 'timeout') {
      await page.waitForTimeout(duration);
    } else if (type === 'selector' && selector) {
      await page.waitForSelector(selector, { state: 'visible' });
    } else if (type === 'load') {
      await page.waitForLoadState('load');
    }

    return {
      success: true,
      data: { message: `Waited for ${type}` },
    };
  }

  private async getPageInfo(_signal?: AbortSignal): Promise<BrowserOperationResult> {
    const page = this.ensureBrowser();
    const url = page.url();
    const title = await page.title();

    this.state.currentUrl = url;
    this.state.pageTitle = title;

    return {
      success: true,
      data: { url, title },
    };
  }

  private async close(
    params: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<BrowserOperationResult> {
    const closeTabOnly = params.closeTabOnly as boolean;

    if (closeTabOnly && this.context) {
      if (this.currentPage) {
        await this.currentPage.close();
        this.currentPage = await this.context.newPage();
        this.state.status = 'ready';
        this.state.currentUrl = null;
        this.state.pageTitle = null;
      }
    } else {
      await this.shutdown();
    }

    return {
      success: true,
      data: { message: closeTabOnly ? 'Closed tab' : 'Closed browser' },
    };
  }
}
