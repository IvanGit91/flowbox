const {
    dropboxFileDownload,
    dropboxFileList,
    dropboxFileUpload,
    deleteDropboxFileAction
} = require("../services/dropbox")
const { writeToLog, raiseError, removeFile, envToBool } = require("../utils/utility")
const { DROPBOX_FOLDER, DROPBOX_BACKUP_FOLDER, STORAGE_PATH, FROM_MAIL, TO_MAIL }
    = require("../config/constant")
const { sendMail } = require("../services/mailer")
const { emlDownloadAttachments, emlGetSender } = require("../utils/eml")

const ACCEPTED_EXTENSIONS = ['pdf']
const isEml = envToBool("PROCESS_EML")


/**
 * @function retrieveFileFlow
 * @description This function download files from Dropbox and then
 *              uploads them to a mail.
 * @param {boolean} [deleteDropboxFile=true] - If true, the file will be deleted
 *                                            after the upload
 * @param {boolean} [deleteLocalFile=true] - If true, the file will be deleted
 *                                          after the upload
 * @returns {Promise<Array<string>>} - The array of results
 */
const retrieveFileFlow = async (deleteDropboxFile = true, deleteLocalFile = true) => {
    let results = []
    let dropboxFiles = { has_more: true }
    let iter = 0
    do {
        // The files are deleted, so no needs to pass the 'cursor' if 'has_more = true'
        dropboxFiles = await dropboxFileList(DROPBOX_FOLDER)
        if (!dropboxFiles) {
            await writeToLog("Dropbox file list error")
            raiseError("Dropbox file list error")
        }
        for (const file of dropboxFiles.entries) {
            console.log("Processing:", file)
            const res = await uploadFileFlow(file["path_display"], deleteDropboxFile, deleteLocalFile, DROPBOX_BACKUP_FOLDER, file[".tag"], FROM_MAIL, TO_MAIL, )
            results.push(res)
        }
        iter += 1
    } while (dropboxFiles.has_more && iter <= 5)
    return results
};


/**
 * @function uploadFileFlow
 * @description This function downloads a file from Dropbox, uploads it to a mail,
 *              and then uploads it to a backup folder.
 * @param {string} filePath - The path of the file to download
 * @param {boolean} [deleteDropboxFile=true] - If true, the file will be deleted
 *                                            after the upload
 * @param {boolean} [deleteLocalFile=true] - If true, the file will be deleted
 *                                          after the upload
 * @param {string} backupFolder - The folder where the file will be uploaded
 * @param {string} fileTag - The tag of the file to download
 * @param {string} from - The sender's mail
 * @param {string} to - The recipient's mail
 * @returns {Promise<Array<string>>} - The array of results
 */
const uploadFileFlow = async (filePath, deleteDropboxFile, deleteLocalFile, backupFolder, fileTag, from, to) => {
    let result = [];
    let local_file_path = '';
    let local_eml_file = ''
    try {
        const dropboxFile = await dropboxFileDownload(filePath, fileTag);
        // check file downloaded from DropBox exists
        if (!dropboxFile) {
            await writeToLog("Dropbox download failed")
            raiseError("Dropbox download failed")
        }
        let filename = dropboxFile.name
        local_eml_file = filename
        let extensionArr = filename.split(".")
        let extension = extensionArr[extensionArr.length - 1].toLowerCase()
        if (isEml && extension === 'eml') {
            const emlPath = `${STORAGE_PATH}/${dropboxFile.name}`
            const emlSender = await emlGetSender(emlPath)
            const attachments = await emlDownloadAttachments(emlPath, emlSender)
            if (!attachments || attachments.length === 0) {
                removeFiles(filename, dropboxFile.name)
                await deleteDropboxFileAction(deleteDropboxFile, filePath)
                await writeToLog("No file found in the EML file")
                raiseError("No file found in the EML file")
            }
            filename = attachments[0]
            local_file_path = filename
            extensionArr = filename.split(".")
            extension = extensionArr[extensionArr.length - 1].toLowerCase()
        }
        if (ACCEPTED_EXTENSIONS.includes(extension)) {
            const mailSubject = `Attachment - ${filename}`
            const mailBody = `Attachment - ${filename}`
            const mailSent = await sendMail(from, to, mailSubject, mailBody, filename)
            if (!mailSent) {
                await writeToLog(`Error while sending the mail`);
                raiseError("Error while sending the mail")
            } else {
                await writeToLog(`Mail ${mailSent} send successfully to ${to}`, 'INFO')
                result.push(`Mail ${mailSent} send successfully to ${to}`)
            }
        } else {
            await writeToLog(`File not processed ${filename} because ${extension} is not a pdf`)
            removeFiles(filename, dropboxFile.name)
            await deleteDropboxFileAction(true, filePath)
            raiseError(`File not processed ${filename} because ${extension} is not a pdf`)
        }

        const fileDest = `${backupFolder}/${filename}`
        const dropboxFileUploaded = await dropboxFileUpload(filename, fileDest)
        if (!dropboxFileUploaded) {
            await writeToLog(`Error While Uploading the file`)
            raiseError(`Error While Uploading the file`)
        }

        // const fileMoved = await dropboxFileMove(filePath, `${backupFolder}/${filename}`)
        // if (!fileMoved) {
        //     await writeToLog(`Error while moving the file`);
        //     raiseError(`Error while moving the file`)
        // }
        await deleteDropboxFileAction(deleteDropboxFile, filePath)
        if (deleteLocalFile) {
            removeFiles(filename, dropboxFile.name)
        }
    } catch (e) {
        removeFiles(local_file_path, local_eml_file)
        await writeToLog(JSON.stringify(e))
    }
    return result
};

function removeFiles(filename, emlFilename) {
    if (filename !== "")
        removeFile(filename)
    if (isEml && filename !== emlFilename && emlFilename !== "") {
        removeFile(emlFilename)
    }
}

module.exports = { retrieveFileFlow };
