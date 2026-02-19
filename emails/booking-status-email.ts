interface BookingStatusEmailProps {
  recipientName: string;
  bookingNumber: string;
  serviceName: string;
  newStatus: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
}

export const BookingStatusEmail = ({
  recipientName,
  bookingNumber,
  serviceName,
  newStatus,
  message,
  ctaText,
  ctaUrl,
}: BookingStatusEmailProps) => {
  const statusColors: Record<string, { bg: string; text: string }> = {
    CONFIRMED: { bg: '#E8F5E9', text: '#2E7D32' },
    IN_PROGRESS: { bg: '#E3F2FD', text: '#1565C0' },
    COMPLETED: { bg: '#E8F5E9', text: '#1B5E20' },
    CANCELLED: { bg: '#FFEBEE', text: '#C62828' },
  };

  const colors = statusColors[newStatus] || { bg: '#F5F5F5', text: '#333333' };

  const statusLabel = newStatus.replace('_', ' ');

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Booking Update — Nuvylux</title>
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
        padding: 30px;
        text-align: center;
      }
      .header h1 {
        color: #ffffff;
        margin: 0;
        font-weight: 700;
        letter-spacing: 4px;
        font-size: 20px;
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
      .status-badge {
        display: inline-block;
        padding: 8px 20px;
        background-color: ${colors.bg};
        color: ${colors.text};
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 1px;
        text-transform: uppercase;
        border-radius: 4px;
      }
      .detail-box {
        margin: 24px 0;
        padding: 20px;
        background-color: #f9f9f9;
        border-left: 3px solid #2E8B57;
        border-radius: 2px;
      }
      .detail-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #999;
        margin-bottom: 4px;
      }
      .detail-value {
        font-size: 15px;
        font-weight: 600;
        color: #0A0A0A;
        margin: 0;
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
          <h2>Booking Update</h2>
          <p>Hello ${recipientName},</p>
          <p>${message}</p>

          <div class="detail-box">
            <p class="detail-label">Booking Reference</p>
            <p class="detail-value">${bookingNumber}</p>
            <br />
            <p class="detail-label">Service</p>
            <p class="detail-value">${serviceName}</p>
            <br />
            <p class="detail-label">New Status</p>
            <p class="detail-value"><span class="status-badge">${statusLabel}</span></p>
          </div>

          ${
            ctaText && ctaUrl
              ? `<div class="btn-container">
              <a href="${ctaUrl}" class="btn">${ctaText}</a>
            </div>`
              : ''
          }

          <p style="margin-top: 40px;">Best regards,</p>
          <p><strong>The Nuvylux Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Nuvylux Global | AURANOVA Group</p>
          <p>Lagos &bull; Abuja &bull; Ibadan</p>
          <p>If you have any questions, please <a href="mailto:support@nuvylux.com">contact support</a>.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;
};
