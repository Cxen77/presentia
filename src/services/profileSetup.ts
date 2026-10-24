export const PROFILE_SETUP_STEPS = 7;
export function profileStepError(
  step: number,
  values: {
    fullName: string;
    usn: string;
    classRollNumber: string;
    section: string;
  },
) {
  if (step === 2 && !values.fullName.trim())
    return "Enter your full name to continue.";
  if (step === 3 && !values.usn.trim())
    return "Enter your university USN to continue.";
  if (step === 4 && !values.classRollNumber.trim())
    return "Enter your class roll number to continue.";
  if (step === 4 && values.classRollNumber.trim().length > 20)
    return "Use at most 20 characters for your class roll number.";
  if (step === 5 && !values.section.trim())
    return "Enter your section to continue.";
  if (step === 5 && values.section.trim().length > 30)
    return "Use at most 30 characters for your section.";
  return null;
}
