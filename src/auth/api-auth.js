const authenticateKey = (req, res, next) => {
    let apiKey = req.header("x-api-key"); //Add API key to headers
    if (apiKey === process.env.SECRET_API_KEY) {
        next();
    } else {
        //Reject request if API key doesn't match
        res.status(403).send({ error: { code: 403, message: "You are not allowed." } });
    }
};

module.exports = { authenticateKey };
