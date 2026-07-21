import jwt from "jsonwebtoken";

const QR_SECRET =
    process.env.QR_SECRET ||
    "GymManager_QR_SECRET_2026";

export const generateQRToken =
    (customerId) => {

        return jwt.sign(
            {
                customerId,
                purpose: "checkin"
            },
            QR_SECRET,
            {
                expiresIn: "30s"
            }
        );

    };

export const generateStaffQRToken =
    (staffId) => {

        return jwt.sign(
            {
                staffId,
                purpose: "staff-checkin"
            },
            QR_SECRET,
            {
                expiresIn: "30s"
            }
        );

    };

export const verifyQRToken =
    (token) => {

        return jwt.verify(
            token,
            QR_SECRET
        );

    };