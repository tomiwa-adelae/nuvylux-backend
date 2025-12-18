import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Muvylux Backend API</title>
        <style>
          body {
            background: #f9fafb;
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1f2937;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
          }
          h1 {
            font-size: 2rem;
            color: #111827;
            margin-bottom: 0.5rem;
          }
          p {
            font-size: 1rem;
            color: #4b5563;
          }
          .status {
            margin-top: 1rem;
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Nuvylux Backend API</h1>
          <p>Backend services are running smoothly.</p>
          <div class="status">Environment: ${process.env.NODE_ENV ?? 'development'}</div>
        </div>
      </body>
      </html>
    `;
  }
}
