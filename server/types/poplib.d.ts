declare module 'poplib' {
  export class POP3Client {
    constructor(port: number, host: string, options?: { tls?: boolean });
    
    on(event: string, callback: (...args: any[]) => void): void;
    
    connect(): void;
    
    login(user: string, password: string, callback: (err: any, data?: any) => void): void;
    
    stat(callback: (err: any, stats: { count: number; octets: number }) => void): void;
    
    retr(messageNumber: number, callback: (err: any, data: string) => void): void;
    
    dele(messageNumber: number, callback: (err: any) => void): void;
    
    quit(callback: () => void): void;
  }
}
