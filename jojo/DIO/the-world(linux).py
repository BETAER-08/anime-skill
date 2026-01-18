import time
import sys
import os
import signal

GOLD = "\033[38;5;220m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"

DIO_ART = f"""
{GOLD}
      ★ THE WORLD (ザ・ワールド) ★
{RESET}
"""


def za_warudo():
    if os.geteuid() != 0:
        print(f"{RED}Error: Root privileges required to bind hardware.{RESET}")
        print(f"Run with: {BOLD}sudo python3 the-world.py{RESET}")
        sys.exit(1)

    try:
        import evdev
    except ImportError:
        print(f"{RED}Error: 'evdev' module not found.{RESET}")
        print(f"Install: sudo pip install evdev")
        sys.exit(1)

    print(f"\n{GOLD}「 THE WORLD 」... Initializing hardware bind.{RESET}")

    devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
    targets = []

    for dev in devices:
        name = dev.name.lower()
        if any(x in name for x in ['keyboard', 'mouse']):
            targets.append(dev)

    if not targets:
        targets = devices

    print(f"{GOLD}Target Locked: {len(targets)} Input Devices.{RESET}")
    print(DIO_ART)
    time.sleep(1)
    print(f"     {RED}{BOLD} TOKI WA TOMARE! (시간이여 멈춰라!) {RESET}\n")
    print(f"{RED}>>> Input devices are now frozen for 9 seconds.{RESET}\n")

    try:
        for dev in targets:
            try:
                dev.grab()
            except Exception:
                pass

        total_seconds = 9
        for i in range(1, total_seconds + 1):
            time.sleep(1)
            sys.stdout.write(f"\r{GOLD}⏳ {i}s Elapsed... (Frozen){RESET}")
            sys.stdout.flush()

            if i == 7:
                sys.stdout.write(f"\n{RED}{BOLD} ROAD ROLLER DA!!!!{RESET}\n")

    except KeyboardInterrupt:
        pass

    finally:
        print(f"\n\n{BOLD}Soshite, Toki wa Ugokidasu...{RESET}")
        for dev in targets:
            try:
                dev.ungrab()
            except:
                pass
        print(f"✅ Hardware control restored.")


if __name__ == "__main__":
    za_warudo()