export const ForgotPasswordEmail = ({
  firstName,
  otp,
}: {
  firstName: string;
  otp: string;
}) => {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Secure Your Nuvylux Account</title>
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
      .otp-container {
        margin: 30px 0;
        padding: 20px;
        background-color: #f3f4f6;
        border-radius: 4px;
        border: 1px dashed #2E8B57;
      }
      .otp-code {
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 8px;
        color: #0A0A0A;
        margin: 0;
      }
      .expiry-text {
        font-size: 12px;
        color: #C1272D; /* Crimson Red for urgency */
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
          <h2>Security Verification</h2>
          <p>Hello ${firstName}, we received a request to reset your Nuvylux account password. Use the verification code below to proceed.</p>
          
          <div class="otp-container">
            <p class="otp-code">${otp}</p>
            <p class="expiry-text">This code expires in 10 minutes</p>
          </div>

          <p style="font-size: 14px; color: #666;">If you did not request this, please secure your account by changing your password or contacting our support team immediately.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Nuvylux Global | AURANOVA Group</p>
          <p>This is an automated security notification. Please do not reply to this email.</p>
          <p><a href="mailto:support@nuvylux.com">Contact Security Support</a></p>
        </div>
      </div>
    </div>
  </body>
</html>
`;
};
