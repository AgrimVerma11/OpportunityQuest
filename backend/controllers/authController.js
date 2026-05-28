import {
  registerUserService,
  loginUserService,
} from "../services/authService.js";

import {
  registerValidation,
} from "../validators/authValidator.js";

// REGISTER
export const registerUser = async (req, res) => {

  try {

    const { error } =
      registerValidation.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const user = await registerUserService(
      req.body
    );

    res.status(201).json({
      message: "User registered successfully",
      user,
    });

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });
  }
};

// LOGIN
export const loginUser = async (req, res) => {

  try {

    const { email, password } = req.body;

    const result = await loginUserService(
      email,
      password
    );

    res.status(200).json({
      message: "Login successful",
      token: result.token,

      user: {
        id: result.user._id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });

  } catch (error) {

    res.status(400).json({
      message: error.message,
    });
  }
};