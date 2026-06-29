export const requireStaff =
    (
        req,
        res,
        next
    ) => {

        if (
            !req.user ||
            req.user.isStaff !== true
        ) {

            return res.status(403).json({
                error:
                    "Chỉ nhân viên mới được sử dụng chức năng này"
            });

        }

        next();

    };