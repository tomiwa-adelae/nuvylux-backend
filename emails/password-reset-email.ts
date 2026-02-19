export const PasswordResetEmail = ({
  firstName,
  newPassword,
}: {
  firstName: string;
  newPassword: string;
}) => {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your Password Has Been Reset</title>
    <style>
      body {
        font-family: 'Playfair Display', 'Georgia', serif;
        background-color: #f9f9f9;
        margin: 0;
        padding: 0;
      }
      .wrapper {
        background-color: #f9f9f9;
        padding: 40px 20px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
      }
      .header {
        background-color: #0A0A0A;
        padding: 30px;
        text-align: center;
      }
      .header h1 {
        color: #ffffff;
        margin: 0;
        letter-spacing: 4px;
        font-size: 20px;
        text-transform: uppercase;
      }
      .content {
        padding: 40px;
        color: #333333;
        line-height: 1.6;
        font-family: 'Inter', 'Arial', sans-serif;
        text-align: center;
      }
      h2 {
        color: #0A0A0A;
        font-family: 'Playfair Display', serif;
        font-size: 24px;
        margin-bottom: 10px;
      }
      .password-container {
        margin: 30px 0;
        padding: 20px;
        background-color: #f3f4f6;
        border-radius: 4px;
        border: 1px dashed #2E8B57;
      }
      .password-text {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #0A0A0A;
        margin: 0;
        font-family: monospace;
      }
      .warning-text {
        font-size: 12px;
        color: #C1272D;
        margin-top: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .footer {
        padding: 30px;
        text-align: center;
        font-size: 11px;
        color: #999999;
        background-color: #fcfcfc;
      }
      .footer a { color: #2E8B57; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <h1>Nuvylux</h1>
        </div>
        <div class="content">
          <h2>Password Reset</h2>
          <p>Hello ${firstName}, your account password has been reset by an administrator. Use the temporary password below to log in.</p>

          <div class="password-container">
            <p class="password-text">${newPassword}</p>
            <p class="warning-text">Please change your password after logging in</p>
          </div>

          <p style="font-size: 14px; color: #666;">If you did not expect this change, please contact our support team immediately.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Nuvylux Global | AURANOVA Group</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
          <p><a href="mailto:support@nuvylux.com">Contact Support</a></p>
        </div>
      </div>
    </div>
  </body>
</html>
`;
};
