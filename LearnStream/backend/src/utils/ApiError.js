class ApiError extends Error{
    constructor(
        statusCode,
        message="Something went wrong",
        errors = [],
        stack = ""
    ){
        if (!Number.isInteger(statusCode)) {
            throw new TypeError(
                `ApiError requires a numeric statusCode as its first argument, got ${JSON.stringify(statusCode)}. ` +
                `Did you forget the status code and pass the message first?`
            );
        }

        super(message)
        this.statusCode  = statusCode
        this.data = null
        this.message =  message
        this.success = false
        this.errors = errors

        if (stack){
            this.stack = stack
        } else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}
export {ApiError}