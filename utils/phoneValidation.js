function validatePhoneByCountry(fullPhone) {
  const countryRules = {
    "+251": { length: 9, firstDigit: "9" },
    "+1": { length: 10 },
    "+44": { length: 10 },
    "+254": { length: 9 },
    "+255": { length: 9 },
    "+256": { length: 9 },
  };

  const matchedCode = Object.keys(countryRules).find((code) =>
    fullPhone.startsWith(code),
  );
  if (!matchedCode) return /^\+?[0-9]{10,15}$/.test(fullPhone);

  const rule = countryRules[matchedCode];
  const localNumber = fullPhone.slice(matchedCode.length);
  return (
    /^\d+$/.test(localNumber) &&
    localNumber.length === rule.length &&
    (!rule.firstDigit || localNumber[0] === rule.firstDigit)
  );
}

function normalizeTelegramPhone(value) {
  if (typeof value !== "string" || value.length > 40) return null;

  let phone = value.trim().replace(/[\s().-]/g, "");
  if (!phone || !/^\+?\d+$/.test(phone)) return null;

  if (!phone.startsWith("+")) {
    if (phone.startsWith("251")) {
      phone = `+${phone}`;
    } else if (phone.startsWith("0")) {
      phone = `+251${phone.slice(1)}`;
    } else if (/^9\d{8}$/.test(phone)) {
      phone = `+251${phone}`;
    } else {
      return null;
    }
  }

  return validatePhoneByCountry(phone) ? phone : null;
}

module.exports = { normalizeTelegramPhone, validatePhoneByCountry };
