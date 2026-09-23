const validate = (schema, source = "body") => {

  return (req, res, next) => {

    const { error, value } = schema.validate(
      req[source],
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {

      return res.status(400).json({

        success: false,

        message: "Validation failed",

        errors: error.details.map(
          (err) => err.message
        ),

      });

    }

    if (source === "query") {
      // req.query is a live getter in Express 5 — it re-derives a fresh object
      // from the raw URL on every access rather than returning one persistent
      // object, so mutating (or reassigning) it does not survive to the next
      // read. The validated/defaulted values — including anything Joi filled
      // in via .default(), which the client never sent — go on their own
      // ordinary property instead; routes that validate a query read
      // req.validatedQuery, never req.query, downstream of this middleware.
      req.validatedQuery = value;
    } else {
      req[source] = value;
    }
    next();
  };
};

export default validate;