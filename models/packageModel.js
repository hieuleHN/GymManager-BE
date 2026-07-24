import Package from "./schemas/packageSchema.js";

export const createPackage = async (packageData, callback) => {
  try {
    const {
      name,
      price,
      description,
      duration_days,
      is_active,
      service_id,
      unitPrice,
      disciplineId,
      features,
      durations,
      contractA,
      contractB,
      contractTerms,
      locationId,
      ptSessionsPerMonth,
      isFullMonth,
      combo,
      disciplines,
    } = packageData;
    const pkg = new Package({
      name,
      price,
      description,
      duration_days,
      is_active: is_active !== undefined ? is_active : true,
      service_id,
      unitPrice,
      disciplineId,
      combo: !!combo,
      disciplines: disciplines || [],
      features,
      durations,
      contractA,
      contractB,
      contractTerms,
      locationId,
      ptSessionsPerMonth: ptSessionsPerMonth ?? 0,
      isFullMonth: !!isFullMonth,
    });
    const result = await pkg.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getAllPackages = async (
  page = 1,
  limit = 15,
  locationId,
  disciplineId,
  callback,
) => {
  try {
    const filter = {};
    if (locationId) filter.locationId = locationId;
    if (disciplineId) filter.disciplineId = disciplineId;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Package.find(filter)
        .populate("service_id", "name")
        .populate("disciplineId", "name")
        .populate("disciplines", "name")
        .skip(skip)
        .limit(limit),
      Package.countDocuments(filter),
    ]);
    callback(null, {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    callback(err);
  }
};

export const getPackagesByDiscipline = async (disciplineId, callback) => {
  try {
    const packages = await Package.find({ disciplineId })
      .populate("service_id", "name")
      .populate("disciplineId", "name")
      .populate("disciplines", "name");
    callback(null, packages);
  } catch (err) {
    callback(err);
  }
};

export const getPackageById = async (id, callback) => {
  try {
    const pkg = await Package.findById(id)
      .populate("service_id", "name")
      .populate("disciplineId", "name")
      .exec();
    if (!pkg) return callback(null, []);
    callback(null, [pkg]);
  } catch (err) {
    callback(err);
  }
};

export const updatePackageById = async (id, packageData, callback) => {
  try {
    const {
      name,
      price,
      description,
      duration_days,
      is_active,
      service_id,
      unitPrice,
      disciplineId,
      features,
      durations,
      contractA,
      contractB,
      contractTerms,
      locationId,
      updatedAt,
      ptSessionsPerMonth,
      isFullMonth,
      combo,
      disciplines,
    } = packageData;
    const result = await Package.findByIdAndUpdate(
      id,
      {
        name,
        price,
        description,
        duration_days,
        is_active,
        service_id,
        unitPrice,
        disciplineId,
        combo: !!combo,
        disciplines: disciplines || [],
        features,
        durations,
        contractA,
        contractB,
        contractTerms,
        locationId,
        updatedAt,
        ptSessionsPerMonth: ptSessionsPerMonth ?? 0,
        isFullMonth: !!isFullMonth,
      },
      { new: true },
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getRelatedPackages = async (
  packageId,
  locationId,
  disciplineId,
  limit = 4,
  callback,
) => {
  try {
    const filter = { _id: { $ne: packageId }, is_active: true };
    if (disciplineId) filter.disciplineId = disciplineId;
    if (locationId) filter.locationId = locationId;
    const packages = await Package.find(filter)
      .populate("disciplineId", "name")
      .populate("locationId", "title")
      .limit(limit)
      .exec();
    callback(null, packages);
  } catch (err) {
    callback(err);
  }
};

export const deletePackageById = async (id, callback) => {
  try {
    const { default: UserPackage } =
      await import("./schemas/userPackageSchema.js");
    await UserPackage.deleteMany({ package_id: id });
    await Package.findByIdAndDelete(id);
    callback(null, { affectedRows: 1 });
  } catch (err) {
    callback(err);
  }
};
