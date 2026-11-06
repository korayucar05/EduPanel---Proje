export function isStudentRegistrationRoute(location: { search: string; hash: string }): boolean {
  return new URLSearchParams(location.search).get("mode") === "student-register" ||
    location.hash.includes("student-register");
}
