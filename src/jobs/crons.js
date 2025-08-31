const CronJob = require("node-cron");
const { dropboxRefreshToken, isInitialized } = require("../services/dropbox")
const { writeToLog, raiseError, envToBool } = require("../utils/utility")
const { retrieveFileFlow } = require("../workflows/flow")

exports.dropboxCheckFoldersScheduledJob = () => {
    const scheduledJobFunction = CronJob.schedule(process.env.CRON_DROPBOX_CHECK, async () => {
        console.log("Checking dropbox files");
        if (!isInitialized()) {
            raiseError("Dropbox not initialized yet")
        }
        let results = []
        try {
            results = await retrieveFileFlow(envToBool("DROPBOX_DELETE_FILE"), envToBool("DELETE_LOCAL_FILE"))
            console.log("CRON - Results:", results)
        } catch (e) {
            await writeToLog(JSON.stringify(e))
        }
    });
    scheduledJobFunction.start();
}

exports.refreshTokenScheduledJob = () => {
    const scheduledJobFunction = CronJob.schedule(process.env.CRON_DROPBOX_REFRESH_TOKEN, async () => {
        console.log("Refreshing");
        if (!isInitialized()) {
            raiseError("dropbox still not initialized")
        }
        await dropboxRefreshToken()
        console.log("CRON - token refreshed");
    });

    scheduledJobFunction.start();
}
