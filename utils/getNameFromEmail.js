const getNameFromEmail = (email) => {
  if (!email) return "User";
  const namePart = email.split("@")[0];
  const nameWithSpaces = namePart.replace(/[._]/g, " ");
  return nameWithSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
};

module.exports = { getNameFromEmail };
