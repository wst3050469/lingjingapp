/**
 * nodemailer 类型声明存根
 * 运行时通过动态 import 加载，此处仅用于 TypeScript 编译
 */
declare module 'nodemailer' {
  interface Transporter {
    sendMail(mailOptions: any): Promise<any>;
    verify(): Promise<boolean>;
    close(): void;
  }

  interface CreateTransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    [key: string]: any;
  }

  function createTransport(options: CreateTransportOptions): Transporter;
  export { createTransport, Transporter };
  export default { createTransport };
}
