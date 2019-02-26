const assert = require('assert').ok;
const fs = require('fs');
const path = require('path');
const Z80 = require('z80js');

module.exports.createEmulator = (opts={}) => {
  opts = Object.assign({debug: false, interval: true, clockSpeed: 10}, opts || {});
  let rom = new Uint8Array(new ArrayBuffer(0x1FFF));
  let ram = new Uint8Array(new ArrayBuffer(57343));
  fs.readFileSync(path.join(__dirname, 'firmware.bin')).copy(rom);
  let z80 = new Z80({
    read8: (addr) => {
      if (addr >= 0 && addr < rom.length) {
        return rom[addr];
      } else if (addr >= 0x2000 && addr < 0xFFFF) {
        return ram[addr];
      }
      return 0;
    },
    write8: (addr, v) => {
      if (addr >= 0x2000 && addr < 0xFFFF) {
        ram[addr-0x2000] = v;
      }
    }
  }, {
    read: (addr) => {
      if (opts.debug) {
        console.log(`Read IO - A: ${addr}`);
      }
      return 0x0000;
    },
    write: (addr, v) => {
      if (opts.debug) {
        console.log(`Write IO - A: ${addr}, V: ${v}`);
      }
    }
  }, opts.debug);
  let intv = -1;
  const cycle = () => {
    try {
      if (opts.debug) {
        console.log(z80.disassemble().dasm);
      }
      z80.execute();
      if (opts.debug) {
        z80.dump();
      }
    } catch(err) {
      z80.halted = true;
      console.error(err);
    }
  };
  return {
    z80,
    cycle,
    reset: () => {
      ram.fill(0);
      z80.reset();
    },
    start: () => {
      if (opts.debug) {
        z80.dump();
      }
      if (opts.interval) {
        assert(intv === -1, 'CPU is already running.');
        intv = setInterval(() => {
          z80.halted = z80.disassemble().dasm === 'nop';
          if (z80.halted) {
            clearInterval(intv);
            intv = -1;
          } else {
            cycle();
          }
        }, opts.clockSpeed);
      } else {
        while (!z80.halted) {
          cycle();
          z80.halted = z80.disassemble().dasm === 'nop';
        }
      }
    },
    stop: () => {
      z80.halted = true;
    }
  };
};

// vim:set ts=2 sw=2 et:
