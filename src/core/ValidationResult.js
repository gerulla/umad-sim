export class ValidationResult {
  constructor({ status, passed = false, messages = [], failures = [] }) {
    this.status = status;
    this.passed = passed;
    this.messages = messages;
    this.failures = failures;
  }

  static pass(messages = []) {
    return new ValidationResult({ status: 'pass', passed: true, messages });
  }

  static fail(failures = [], messages = []) {
    return new ValidationResult({ status: 'fail', passed: false, failures, messages });
  }

  static pending(messages = []) {
    return new ValidationResult({ status: 'pending', passed: false, messages });
  }
}
