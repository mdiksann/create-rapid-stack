export class ScaffoldError extends Error {
  constructor(message, hint = "") {
    super(message);
    this.name = "ScaffoldError";
    this.hint = hint;
  }
}

