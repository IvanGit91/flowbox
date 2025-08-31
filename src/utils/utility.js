const { STORAGE_PATH } = require("../config/constant")

const fs = require('fs')
const fse = require('fs-extra')
const dateFormat = (...args) =>
    import("dateformat").then(({ default: dateFormat }) => dateFormat(...args));

const logger = (msg) => {
    console.log(msg)
}

const raiseError = (msg) => {
    logger(msg)
    throw new Error(msg)
}

const writeToLog = async (data, level = 'ERROR', filename = 'fatture.log') => {
    const formattedDate = await dateFormat(new Date(), "dd-mm-yyyy h:MM:ss");
    const message = `[${level}] [${formattedDate}] *** ${data} ***`
    const path = `${STORAGE_PATH}/${filename}`
    if (fs.existsSync(path)) {
        fs.appendFileSync(path, `\n${message}`);
    } else {
        fs.writeFileSync(path, message);
    }
}

const removeFile = (filename) => {
    const path = `${STORAGE_PATH}/${filename}`
    if (fse.pathExistsSync(path)) {
        fse.removeSync(path)
    } else {
        console.log("error - remove file",filename)
    }
}

const addHours = (hours, date = new Date()) => {
    date.setHours(date.getHours() + hours);
    return date;
}

function envToBool(envVar) {
    return process.env[envVar] === undefined ? false : JSON.parse(process.env[envVar])
}

function strToBool(str) {
    return str !== undefined && JSON.parse(str);
}

function strToNumber(str, defValue = 0) {
    return str !== undefined && isStrANumber(str) ? Number(str) : defValue;
}

function isStrANumber(value) {
    if (typeof value === "string") {
        return !isNaN(value);
    }
    return false
}

module.exports = { logger, raiseError, writeToLog, removeFile, addHours, envToBool }
