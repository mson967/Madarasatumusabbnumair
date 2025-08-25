const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Send email function
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.SCHOOL_NAME}" <${process.env.EMAIL_FROM}>`,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;

  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

// Send bulk emails
const sendBulkEmail = async (recipients, { subject, text, html }) => {
  try {
    const transporter = createTransporter();
    const results = [];

    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: `"${process.env.SCHOOL_NAME}" <${process.env.EMAIL_FROM}>`,
          to: recipient.email,
          subject: subject,
          text: text,
          html: html.replace(/{{name}}/g, recipient.name || 'Student/Parent')
        };

        const info = await transporter.sendMail(mailOptions);
        results.push({
          email: recipient.email,
          success: true,
          messageId: info.messageId
        });

      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        results.push({
          email: recipient.email,
          success: false,
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    console.error('Bulk email sending failed:', error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  registrationConfirmation: (data) => ({
    subject: 'Registration Confirmation - Musab Bin Umair Memorial School',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a5e3c; color: white; padding: 20px; text-align: center;">
          <h1>Musab Bin Umair Memorial School</h1>
          <p>Registration Confirmation</p>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear ${data.parentName},</p>
          
          <p>Assalamu Alaikum wa Rahmatullahi wa Barakatuh,</p>
          
          <p>Thank you for registering ${data.studentName} at Musab Bin Umair Memorial School. We are honored to be part of your child's Islamic educational journey.</p>
          
          <div style="background: #f4f9f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #1a5e3c; margin-top: 0;">Registration Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Student Name:</strong> ${data.studentName}</li>
              <li><strong>Age:</strong> ${data.studentAge} years</li>
              <li><strong>Section:</strong> ${data.section}</li>
              <li><strong>Payment Plan:</strong> ${data.paymentPlan}</li>
              <li><strong>Registration ID:</strong> ${data.registrationId}</li>
            </ul>
          </div>
          
          <p>Our admissions team will contact you within 2-3 business days with further instructions regarding:</p>
          <ul>
            <li>Payment procedures</li>
            <li>Required documents</li>
            <li>Orientation schedule</li>
            <li>Academic calendar</li>
          </ul>
          
          <p>If you have any questions, please don't hesitate to contact us:</p>
          <ul>
            <li><strong>Phone:</strong> ${process.env.SCHOOL_PHONE}</li>
            <li><strong>Email:</strong> ${process.env.SCHOOL_EMAIL}</li>
          </ul>
          
          <p>May Allah bless your child's educational journey and grant them success in both Dunya and Akhirah.</p>
          
          <p>Barakallahu feeki,<br>
          <strong>Admissions Team</strong><br>
          Musab Bin Umair Memorial School</p>
        </div>
        
        <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; 2023 Musab Bin Umair Memorial School. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  contactAutoReply: (data) => ({
    subject: 'Thank you for contacting us - Musab Bin Umair Memorial School',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a5e3c; color: white; padding: 20px; text-align: center;">
          <h1>Musab Bin Umair Memorial School</h1>
          <p>Thank you for your message</p>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear ${data.name},</p>
          
          <p>Assalamu Alaikum wa Rahmatullahi wa Barakatuh,</p>
          
          <p>We have received your message and appreciate you taking the time to contact us.</p>
          
          <div style="background: #f4f9f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #1a5e3c; margin-top: 0;">Your Message Details:</h3>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Reference ID:</strong> ${data.messageId}</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>Our team will review your message and respond within 24-48 hours during business days (Sunday to Thursday, 8:00 AM - 5:00 PM).</p>
          
          <p>For urgent matters, please contact us directly:</p>
          <ul>
            <li><strong>Phone:</strong> ${process.env.SCHOOL_PHONE}</li>
            <li><strong>WhatsApp:</strong> Available during business hours</li>
          </ul>
          
          <p>May Allah bless you and your family.</p>
          
          <p>Barakallahu feeki,<br>
          <strong>Customer Service Team</strong><br>
          Musab Bin Umair Memorial School</p>
        </div>
        
        <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; 2023 Musab Bin Umair Memorial School. All rights reserved.</p>
        </div>
      </div>
    `
  })
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  emailTemplates
};