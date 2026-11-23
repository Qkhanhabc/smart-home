#include "ir_feedback.h"

// Feedback GPIOs from the standalone AC board conflict with peripherals in the
// user's Smart Home wiring. Keep these hooks inert so the alarm buzzer/LED stay
// under the original Smart Home logic.
IrFeedback irFeedback;
void IrFeedback::begin() {}
void IrFeedback::poll() {}
void IrFeedback::onCommandTx() {}
void IrFeedback::setCmdLed(bool) {}
void IrFeedback::setBuzzer(bool) {}
void IrFeedback::advanceCmdBlink(uint32_t) {}
