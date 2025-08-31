const express = require('express')
const app = express()
const port = 3500
const API = require('./auth/api-auth');
const bodyParser = require("body-parser")
const cors = require('cors');
const { dropboxCheckFoldersScheduledJob, refreshTokenScheduledJob } = require("./jobs/crons")
const {
    dropboxAuthFlow,
    dropboxCodeToken,
    dropboxRefreshToken,
} = require("./services/dropbox")
const { removeFile, envToBool } = require("./utils/utility")
const ErrorHandler = require("./errors/error-handler")
const fs = require("fs")
const fse = require("fs-extra")
const { TOKEN_FILE_PATH, TOKEN_FILE_NAME, STORAGE_PATH } = require("./config/constant")
const { initMailingService } = require("./services/mailer")

require('dotenv').config()
app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
app.use(cors());

app.use(bodyParser.json({
    verify: (req, res, buf, encoding) => {
        if (buf && buf.length) {
            req.rawBody = buf.toString(encoding || 'utf8');
        }
    },
}))

const genAPIKey = () => {
    //create a base-36 string that contains 30 chars in a-z,0-9
    return [...Array(30)]
        .map((e) => ((Math.random() * 36) | 0).toString(36))
        .join('');
};

app.get('/ping', API.authenticateKey, (req, res) => {
    res.status(200).send({
        version: "ciao"
    });
})

app.get('/api/dropbox-sso-callback', async (req, res, next) => {
    try {
        const { code } = req.query
        await dropboxAuthFlow()
        const dropboxToken = await dropboxCodeToken(code)
        res.status(200).send(dropboxToken);
    } catch (e) {
        next(e)
    }
})

// This method is used to verify the webhook
// app.get('/api/dropbox-webhook', async (req, res, next) => {
//     try {
//         res.setHeader['Content-Type'] = 'text/plain'
//         res.setHeader['X-Content-Type-Options'] = 'nosniff'
//         res.status(200).send(req.query.challenge);
//     } catch (e) {
//         next(e)
//     }
// })
//
// let webhookExecuting = false
// // This method is used to receive the event from the webhook
// app.post('/api/dropbox-webhook', async (req, res, next) => {
//     if (!req.rawBody) {
//         return next('Request body empty')
//     }
//     try {
//         let results = []
//         if (!webhookExecuting) {
//             webhookExecuting = true
//             await verifySignature(req)
//             const body = req.body
//             if ('list_folder' in body && 'accounts' in body.list_folder) {
//                 results = await fattureFlow()
//             }
//             webhookExecuting = false
//         }
//         res.status(200).send(results);
//     } catch (e) {
//         console.error(e)
//         webhookExecuting = false
//         next(e)
//     }
// })

// ADD CALL to execute your function(s)
if (envToBool("ENABLE_CRON")) {
    dropboxCheckFoldersScheduledJob();
    refreshTokenScheduledJob();
}

// ERROR HANDLER MIDDLEWARE (Last middleware to use)
app.use(ErrorHandler)


// Error handling Middleware function for logging the error message
const errorLogger = (error, request, response, next) => {
    console.log(`error ${error.message}`)
    next(error) // calling next middleware
}

// Fallback Middleware function for returning
// 404 error for undefined paths
const invalidPathHandler = (request, response, next) => {
    response.status(404)
    response.send('invalid path')
}


// Attach the first Error handling Middleware
// function defined above (which logs the error)
app.use(errorLogger)

// Attach the fallback Middleware
// function which sends back the response for invalid paths)
app.use(invalidPathHandler)


app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error(err);
        return res.status(400).send({ status: 404, message: err.message }); // Bad request
    }
    next();
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})

initMailingService().then(() => {
    console.log("Mailing services initialized successfully")
}).catch(err => {
    console.error(err)
})

if (envToBool("REFRESH_AT_START")) {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
        try {
            dropboxAuthFlow().then(() => {
                dropboxRefreshToken().then(() => console.log("Token refreshed")).catch((err) => {
                    console.error("Refresh token:", err)
                    removeFile(TOKEN_FILE_NAME)
                })
            }).catch(err => console.log(err))
        } catch (err) {
            console.error(err)
        }
    }
}

fse.ensureDirSync(STORAGE_PATH, {})
