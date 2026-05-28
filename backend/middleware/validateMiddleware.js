const validate = (schema) => {

  return (req, res, next) => {

    console.log("Incoming Body:", req.body);

    const { error } = schema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {

      console.log(error.details);

      return res.status(400).json({

        success: false,

        message: "Validation failed",

        errors: error.details.map(
          (err) => err.message
        ),

      });

    }

    next();
  };
};

export default validate;