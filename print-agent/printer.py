"""Thin wrapper around the physical thermal printer.

Isolated behind print_label() so agent.py/labels.py can swap in a fake for
testing without hardware. Specific printer model/protocol details beyond a
plain ESC/POS network printer are out of scope for now - see
docs/adr/0001-local-print-agent-for-cup-labels.md.
"""

from escpos.printer import Network


class CupLabelPrinter:
    def __init__(self, host: str, port: int = 9100):
        self._host = host
        self._port = port

    def print_label(self, text: str) -> None:
        printer = Network(self._host, port=self._port)
        try:
            printer.text(text + "\n")
            printer.cut()
        finally:
            printer.close()
