const fs = require('fs')
const { STORAGE_PATH } = require("../config/constant")
const EmlParser = require('eml-parser');

const defaultOptions = { ignoreEmbedded: false }
const ACCEPTED_EXTENSIONS = ['pdf']

exports.emlParseEmail = async (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            new EmlParser(fs.createReadStream(filePath))
                .parseEml(defaultOptions) //options: {ignoreEmbedded: true} to ignore embedded files
                .then(result => {
                    // properties in result object:
                    // {
                    //	"attachments": [],
                    //	"headers": {},
                    //	"headerLines": [],
                    //	"html": "",
                    //	"text": "",
                    //	"textAsHtml": "",
                    //	"subject": "",
                    //	"references": "",
                    //	"date": "",
                    //	"to": {},
                    //	"from": {},
                    //	"cc": {},
                    //	"messageId": "",
                    //	"inReplyTo": ""
                    // }
                    console.log(result);
                    resolve(result)
                })
                .catch(err => {
                    console.log(err);
                    reject(err)
                })
        } catch (error) {
            console.error(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.emlGetSender = async (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            new EmlParser(fs.createReadStream(filePath))
                .parseEml(defaultOptions) //options: {ignoreEmbedded: true} to ignore embedded files
                .then(result => {
                    resolve(result.from.value[0].name.toLowerCase().replaceAll(" ",""))
                })
                .catch(err => {
                    console.log(err);
                    reject(err)
                })
        } catch (error) {
            console.error(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.emlDownloadAttachments = async (filePath, prefix="file") => {
    return new Promise((resolve, reject) => {
        try {
            new EmlParser(fs.createReadStream(filePath))
                .getEmailAttachments() //options: {ignoreEmbedded: true} to ignore embedded files
                .then(attachments => {
                    let fileSaved = []
                    attachments.forEach(attachment => {
                        // attachment.content is the buffer object
                        // console.log(attachment.filename, attachment.content);
                        const extensionArr = attachment.filename.split(".")
                        const tempFilename = extensionArr.slice(0, extensionArr.length - 1).join()
                        const extension = extensionArr[extensionArr.length - 1].toLowerCase()
                        if (ACCEPTED_EXTENSIONS.includes(extension)) {
                            const filename = `${prefix}-${tempFilename}-${Date.now()}.${extension}`
                            const fileDest = `${STORAGE_PATH}/${filename}`
                            try {
                                fs.writeFileSync(fileDest, attachment.content)
                                fileSaved.push(filename)
                            } catch (error) {
                                console.log("Error writing the file", error)
                            }
                        }
                    });
                    resolve(fileSaved)
                })
                .catch(err => {
                    console.log(err);
                    reject(err)
                })
        } catch (error) {
            console.error(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};
