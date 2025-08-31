const dropboxV2Api = require('dropbox-v2-api');
const fs = require('fs')
const fse = require('fs-extra')
const { raiseError, addHours, writeToLog } = require("../utils/utility")
const { TOKEN_FILE_PATH, STORAGE_PATH } = require("../config/constant")
const crypto = require("crypto")
require('dotenv').config()

const sigHeaderName = 'X-Dropbox-Signature'
const algo = 'sha256'

let isInitialized = false
let dropbox = dropboxV2Api.authenticate({
    token: process.env.DROPBOX_API_TOKEN
});

exports.isInitialized = () => {
    return isInitialized
};

exports.verifySignature = async (req) => {
    const sig = Buffer.from(req.get(sigHeaderName) || '', 'utf8')
    const hmac = crypto.createHmac(algo, process.env.DROPBOX_CLIENT_SECRET);
    const digest = Buffer.from(hmac.update(req.rawBody).digest('hex'), 'utf8')
    if (sig.length !== digest.length || !crypto.timingSafeEqual(digest, sig)) {
        raiseError(`Request body digest (${digest}) did not match ${sigHeaderName} (${sig})`)
    }
    return true
}

exports.dropboxAuthFlow = async () => {
    return new Promise((resolve, reject) => {
        try {
            dropbox = dropboxV2Api.authenticate({
                client_id: process.env.DROPBOX_CLIENT_ID,
                client_secret: process.env.DROPBOX_CLIENT_SECRET,
                redirect_uri: process.env.DROPBOX_REDIRECT_URI,
                token_access_type: 'offline', // if you need an offline long-living refresh token
                state: 'need_acc_token'
            });
            //generate and visit authorization services
            const authUrl = dropbox.generateAuthUrl();
            console.log("authURL", authUrl)
            resolve(authUrl)
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.dropboxCodeToken = async (code) => {
    return new Promise((resolve, reject) => {
        try {
            dropbox.getToken(code, (err, result, response) => {
                if (err) {
                    reject(err)
                } else {
                    result.will_expire = addHours(4)
                    fse.writeJsonSync(TOKEN_FILE_PATH, { ...result })
                    isInitialized = true
                    resolve(result)
                }
            });
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.dropboxRefreshToken = async (refresh_token = null) => {
    if (!refresh_token && fs.existsSync(TOKEN_FILE_PATH)) {
        const tokenObj = fse.readJsonSync(TOKEN_FILE_PATH)
        const tokenDate = new Date(tokenObj.will_expire)
        if (Date.now() > tokenDate) {
            raiseError("Token expired")
        }
        refresh_token = tokenObj.refresh_token
    }
    if (!refresh_token) {
        raiseError("no refresh token found")
    }
    return new Promise((resolve, reject) => {
        try {
            dropbox.refreshToken(refresh_token, (err, result, response) => {
                if (err) {
                    reject(err)
                } else {
                    if (fs.existsSync(TOKEN_FILE_PATH) && result?.access_token) {
                        const tokenObj = fse.readJsonSync(TOKEN_FILE_PATH)
                        tokenObj.access_token = result.access_token
                        tokenObj.will_expire = addHours(4)
                        fse.writeJsonSync(TOKEN_FILE_PATH, { ...tokenObj })
                    }
                    isInitialized = true
                    resolve(result)
                }
            });
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.dropboxFileList = async (path) => {
    return new Promise((resolve, reject) => {
        try {
            dropbox({
                resource: 'files/list_folder',
                parameters: {
                    path: `${path}`
                }
            }, (err, result, response) => {
                if (err) {
                    reject(err)
                }
                resolve(result)
            });
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.dropboxFileUpload = async (localPath, dropboxPath) => {
    return new Promise((resolve, reject) => {
        try {
            dropbox({
                resource: 'files/upload',
                parameters: {
                    autorename: true,
                    path: `${dropboxPath}`,
                    mode: "add"
                },
                readStream: fs.createReadStream(`${STORAGE_PATH}/${localPath}`)
            }, (err, result, response) => {
                if (err) {
                    reject(err)
                }
                resolve(result)
            });
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.dropboxFileMove = async (fromPath, toPath) => {
    new Promise((resolve, reject) => {
        try {
            dropbox({
                resource: 'files/move_v2',
                parameters: {
                    allow_ownership_transfer: false,
                    allow_shared_folder: false,
                    autorename: true,   // Auto-rename if there is a conflict
                    from_path: fromPath,
                    to_path: toPath
                }
            }, (err, result, response) => {
                if (err) {
                    reject(err)
                }
                resolve(result)
            });
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};
async function dropboxDownloadSingleFile(path, filename) {
    try {
        return new Promise((resolve, reject) => {
            try {
                dropbox({
                    resource: 'files/download',
                    parameters: {
                        path: `${path}`
                    }
                }, (err, result, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }).pipe(fs.createWriteStream(`${STORAGE_PATH}/${filename}`));
            } catch (error) {
                reject(error);
            }
        });
    } catch (e) {
        return console.error(e);
    }
};


exports.dropboxFileDownload = async (path, fileTag) => {
    const arr = path.split("/")
    const filename = arr[arr.length - 1]
    if (fileTag === "folder") {
        const fileList = await exports.dropboxFileList(path);
        if (!fileList) {
            await writeToLog("Dropbox list failed")
            raiseError("Dropbox list failed")
        } else {
            const firstEntrieArray = fileList["entries"]
            if (firstEntrieArray.length > 0) {
                const path_display = firstEntrieArray[0].path_display ?? ''
                const innerArr = path_display.split("/")
                const innerFilename = innerArr[innerArr.length - 1]
                return await dropboxDownloadSingleFile(path_display, innerFilename)
            }
        }
    } else {
        return await dropboxDownloadSingleFile(path, filename)
    }
};

exports.dropboxFileDelete = async (path) => {
    return new Promise((resolve, reject) => {
        try {
            dropbox({
                resource: 'files/delete_v2',
                parameters: {
                    path: `${path}`
                }
            }, (err, result, response) => {
                if (err) {
                    reject(err)
                }
                resolve(result)
            });
        } catch (error) {
            console.log(error);
            reject(error)
        }
    }).catch(e => console.error(e));
};

exports.deleteDropboxFileAction = async (deleteDropboxFile,filePath) => {
    if (deleteDropboxFile) {
        const dropboxFileDeleted = await exports.dropboxFileDelete(filePath)
        if (!dropboxFileDeleted) {
            await writeToLog("Dropbox delete failed")
            raiseError("Dropbox delete failed")
        }
    }
}
