// services/emailService.js
const nodemailer = require('nodemailer');

const createTransporter = () => {
  console.log('📧 Creating email transporter...');
  const transporter = nodemailer.createTransport({
    host: "avocarbon-com.mail.protection.outlook.com",
    port: 25,
    secure: false,
    auth: {
      user: "administration.STS@avocarbon.com",
      pass: "shnlgdyfbcztbhxn",
    },
    debug: true, // Enable debug output
    logger: true // Log information in console
  });
  console.log('✅ Transporter created');
  return transporter;
};

const sendValidationRequestEmail = async (adminEmail, projectDetails, requesterDetails, projectId) => {
  console.log('📧 ========== SENDING VALIDATION REQUEST EMAIL ==========');
  console.log('📧 To:', adminEmail);
  console.log('📧 Project:', projectDetails);
  console.log('📧 Requester:', requesterDetails);
  console.log('📧 Project ID:', projectId);

  try {
    const transporter = createTransporter();
    
    // Test the connection
    console.log('🔍 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Create the project URL with the project ID
    const frontendUrl = 'https://sts-project-management.azurewebsites.net';
    const projectUrl = `${frontendUrl}/projects/${projectId}`;
    
    console.log('🔗 Project URL:', projectUrl);

    const mailOptions = {
      from: '"Project Management System" <administration.STS@avocarbon.com>',
      to: adminEmail,
      subject: `🔔 Validation Request: ${projectDetails.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4ecdc4;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .project-info {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .info-row {
              margin: 10px 0;
            }
            .label {
              font-weight: bold;
              color: #555;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #4ecdc4;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin-top: 20px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Project Validation Request</h1>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p><strong>${requesterDetails.name}</strong> has requested validation for the following project:</p>
              
              <div class="project-info">
                <div class="info-row">
                  <span class="label">📋 Project Name:</span> ${projectDetails.name}
                </div>
                <div class="info-row">
                  <span class="label">📅 Start Date:</span> ${projectDetails.startDate || 'Not specified'}
                </div>
                <div class="info-row">
                  <span class="label">📅 End Date:</span> ${projectDetails.endDate || 'Not specified'}
                </div>
                <div class="info-row">
                  <span class="label">🆔 Project ID:</span> ${projectId}
                </div>
                <div class="info-row">
                  <span class="label">👤 Requested by:</span> ${requesterDetails.name} (${requesterDetails.email})
                </div>
                <div class="info-row">
                  <span class="label">⏰ Requested at:</span> ${new Date().toLocaleString()}
                </div>
              </div>

              ${projectDetails.comment ? `
                <div class="info-row">
                  <span class="label">📝 Description:</span>
                  <p>${projectDetails.comment}</p>
                </div>
              ` : ''}

              <p>Please review and validate this project in the Project Management System.</p>
              
              <center>
                <a href="${projectUrl}" class="button" style="color: white; text-decoration: none;">
                  Review Project
                </a>
              </center>
              
              <p style="margin-top: 15px; font-size: 14px; color: #666;">
                Or copy and paste this link in your browser:<br>
                <span style="word-break: break-all;">${projectUrl}</span>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated message from the Project Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Project Validation Request
        
        ${requesterDetails.name} has requested validation for the following project:
        
        Project Name: ${projectDetails.name}
        Project ID: ${projectId}
        Start Date: ${projectDetails.startDate || 'Not specified'}
        End Date: ${projectDetails.endDate || 'Not specified'}
        Requested by: ${requesterDetails.name} (${requesterDetails.email})
        Requested at: ${new Date().toLocaleString()}
        
        ${projectDetails.comment ? `Description: ${projectDetails.comment}` : ''}
        
        Please review and validate this project in the Project Management System.
        
        Project URL: ${projectUrl}
      `
    };

    console.log('📧 Mail options prepared:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      projectUrl: projectUrl
    });

    console.log('📤 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ ========== EMAIL SENT SUCCESSFULLY ==========');
    console.log('✅ Message ID:', info.messageId);
    console.log('✅ Response:', info.response);
    
    return { success: true, messageId: info.messageId, projectUrl };
  } catch (error) {
    console.error('❌ ========== EMAIL SEND FAILED ==========');
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Full error:', error);
    throw error;
  }
};


const sendValidationConfirmationEmail = async (memberEmail, projectDetails, validatedBy) => {
  console.log('📧 ========== SENDING VALIDATION CONFIRMATION EMAIL ==========');
  console.log('📧 To:', memberEmail);
  console.log('📧 Project:', projectDetails);
  console.log('📧 Validated by:', validatedBy);

  try {
    const transporter = createTransporter();
    
    // Test the connection
    console.log('🔍 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    const mailOptions = {
      from: '"Project Management System" <administration.STS@avocarbon.com>',
      to: memberEmail,
      subject: `✅ Project Validated: ${projectDetails.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4ecdc4;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .success-badge {
              background-color: #4ecdc4;
              color: white;
              padding: 10px 20px;
              border-radius: 20px;
              display: inline-block;
              margin: 20px 0;
            }
            .project-info {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .info-row {
              margin: 10px 0;
            }
            .label {
              font-weight: bold;
              color: #555;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Project Validated</h1>
            </div>
            <div class="content">
              <p>Great news!</p>
              <p>Your project has been validated by the administrator.</p>
              
              <center>
                <span class="success-badge">✅ VALIDATED</span>
              </center>

              <div class="project-info">
                <div class="info-row">
                  <span class="label">📋 Project Name:</span> ${projectDetails.name}
                </div>
                <div class="info-row">
                  <span class="label">✅ Validated by:</span> ${validatedBy.name}
                </div>
                <div class="info-row">
                  <span class="label">⏰ Validated at:</span> ${new Date().toLocaleString()}
                </div>
              </div>

              <p>Your project is now marked as completed and validated in the system.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from the Project Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Project Validated
        
        Great news! Your project has been validated by the administrator.
        
        Project Name: ${projectDetails.name}
        Validated by: ${validatedBy.name}
        Validated at: ${new Date().toLocaleString()}
        
        Your project is now marked as completed and validated in the system.
      `
    };

    console.log('📧 Mail options prepared:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    console.log('📤 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ ========== EMAIL SENT SUCCESSFULLY ==========');
    console.log('✅ Message ID:', info.messageId);
    console.log('✅ Response:', info.response);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ ========== EMAIL SEND FAILED ==========');
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Full error:', error);
    throw error;
  }
};

module.exports = {
  sendValidationRequestEmail,
  sendValidationConfirmationEmail
};
