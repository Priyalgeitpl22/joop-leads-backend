import { Request, Response } from "express";
import multer from "multer";
import { AuthService } from "../services/auth.service";

const upload = multer({ storage: multer.memoryStorage() }).single("profilePicture");

export const register = async (req: Request, res: Response): Promise<void> => {
  upload(req, res, async (err) => {
    if (err) {
      res.status(400).json({ code: 400, message: "File upload failed", error: err });
      return;
    }

    const { email, fullName, orgName, domain, country, phone, password } = req.body;

    if (!email || !fullName || !password) {
      res.status(400).json({ code: 400, message: "All fields are required." });
      return;
    }

    try {
      const response = await AuthService.register({
        email,
        fullName,
        password,
        orgName,
        domain,
        country,
        phone,
        profilePicture: req.file,
      });
      res.status(response.code).json(response);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: "Server error", error: error.message });
    }
  });
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const response = await AuthService.verifyOtp(email, otp);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Server error" });
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const response = await AuthService.resendOtp(email);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Server error" });
  }
};

export const forgetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const response = await AuthService.forgetPassword(email);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Error sending reset email" });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password, email } = req.body;
    const response = await AuthService.resetPassword(token, password, email);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Something went wrong" });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, existingPassword, newPassword } = req.body;
    const response = await AuthService.changePassword(email, existingPassword, newPassword);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const response = await AuthService.login(email, password);
    res.status(response.code).json(response);
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ code: 500, message: "Server error", error: error.message });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const response = await AuthService.logout(token);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Server error" });
  }
};

export const activateAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password, email } = req.body;
    const response = await AuthService.activateAccount(token, password, email);
    res.status(response.code).json(response);
  } catch {
    res.status(500).json({ code: 500, message: "Error activating account" });
  }
};

export const resendActivationLink = async (req: Request,res: Response): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        code: 400,
        message: "Email is required",
      });
    }

    const response = await AuthService.resendActivation(email);
    return res.status(response.code).json(response);
  } catch (error: any) {
    console.error("Resend activation error:", error);
    return res.status(500).json({
      code: 500,
      message: "Something went wrong. Please try again later.",
    });
  }
};
