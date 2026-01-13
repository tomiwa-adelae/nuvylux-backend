export const WelcomeEmail = ({ firstName }: { firstName: string }) => {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Nuvylux</title>
    <style>
      body { 
        font-family: 'Playfair Display', 'Georgia', serif; 
        background-color: #f9f9f9; 
        margin: 0; 
        padding: 0; 
        -webkit-font-smoothing: antialiased;
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
        overflow: hidden;
      }
      .header { 
        background-color: #0A0A0A; 
        padding: 40px; 
        text-align: center; 
      }
      .header h1 { 
        color: #ffffff; 
        margin: 0; 
        font-weight: 700; 
        letter-spacing: 4px; 
        font-size: 24px; 
        text-transform: uppercase;
      }
      .content { 
        padding: 40px; 
        color: #333333; 
        line-height: 1.6; 
        font-family: 'Inter', 'Arial', sans-serif;
      }
      h2 { 
        color: #0A0A0A; 
        font-family: 'Playfair Display', serif; 
        font-size: 22px; 
        margin-bottom: 20px; 
      }
      .accent { 
        color: #2E8B57; /* Till Green */
        font-weight: bold; 
      }
      .btn-container {
        text-align: center;
        margin-top: 30px;
      }
      .btn { 
        display: inline-block; 
        padding: 16px 32px; 
        background-color: #0A0A0A; 
        color: #ffffff !important; 
        border-radius: 0px; 
        text-decoration: none; 
        font-weight: 600; 
        text-transform: uppercase;
        font-size: 14px;
        letter-spacing: 1px;
      }
      .footer { 
        padding: 30px; 
        text-align: center; 
        font-size: 12px; 
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
          <h2>Welcome to the Movement, ${firstName}.</h2>
          <p>You have successfully entered the <span class="accent">Nuvylux Global</span> ecosystem—the new light of luxury where beauty, fashion, and innovation unite.</p>
          <p>Your account is now active. You are invited to explore our verified marketplace, experience our AI-powered skincare intelligence, and connect with a global community of creators.</p>
          
          <div class="btn-container">
            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Access Your Dashboard</a>
          </div>

          <p style="margin-top: 40px;">Stay visionary,</p>
          <p><strong>The Nuvylux Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Nuvylux Global | AURANOVA Group</p>
          <p>Lagos • Abuja • Ibadan</p>
          <p>If you did not create this account, please <a href="mailto:support@nuvylux.com">contact support</a>.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;
};
