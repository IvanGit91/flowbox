const fs = require('fs')
const nodemailer = require("nodemailer");
const emailConfigSmtp2Go = require("../config/email-service.js");
const { STORAGE_PATH } = require("../config/constant")

let transporter

testBody = () => {
    return composeBody(
        '"Fred Foo 👻" <foo@example.com>',
        "bar@example.com, baz@example.com",
        "Hello ✔",
        "Hello world?",
        //"<b>Hello world?</b>"
        "sample.pdf"
    )
}

composeBody = (from, to, subject, msg, attachmentPath = null) => {
    let data = {
        from: from, // sender address
        to: to, // list of receivers, comma separated
        subject: subject, // Subject line
        text: msg, // plain text body
        // html: html // html body
    };
    if (attachmentPath) {
        const arr = attachmentPath.split("/")
        const filename = arr[arr.length - 1]
        data.attachments = [{
            filename: filename,
            content: fs.createReadStream(`${STORAGE_PATH}/${attachmentPath}`)
        }]
    }
    return data
}

exports.initMailingService = async () => {
    transporter = nodemailer.createTransport(emailConfigSmtp2Go);
}

exports.sendMail = async (from, to, subject, msg, attachment) => {
    if (!transporter) {
        console.error("email not initialized")
        return
    }
    // send mail with defined transport object
    let info = await transporter.sendMail(composeBody(from, to, subject, msg, attachment));

    console.log("Message sent: %s", info.messageId);
    return info.messageId
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
}


