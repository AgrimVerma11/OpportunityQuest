import {
  registerUserService,
  loginUserService,
} from "../services/authService.js";



// =========================
// REGISTER USER
// =========================

export const registerUser = async (
  req,
  res
) => {

  try {

    const user =
      await registerUserService(req.body);

    res.status(201).json({

      success: true,

      message:
        "User registered successfully",

      data: {
        user,
      },

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      message:
        error.message || "Server error",

    });
  }
};



// =========================
// LOGIN USER
// =========================

export const loginUser = async (
  req,
  res
) => {

  try {

    const { email, password } = req.body;

    const result =
      await loginUserService(
        email,
        password
      );

    res.status(200).json({

      success: true,

      message: "Login successful",

      data: {

        token: result.token,

        user: {
          id: result.user._id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },

      },

    });

  } catch (error) {

    console.error(error);

    res.status(400).json({

      success: false,

      message:
        error.message || "Login failed",

    });
  }
};