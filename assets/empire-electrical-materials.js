/* Empire Electrical Department — MEP inventory materials (Inventory Bezhan sheet MEP) */
(function () {
  var CATALOG = [
    { name: "SP-0002 main breaker A9R44463", variants: [], priority: true, yellow: true },
    { name: "SP-0004 mcb 1P 20A", variants: [], priority: true, yellow: true },
    { name: "SP-0005 mcb 1P 25A", variants: [], priority: true, yellow: true },
    { name: "SP-0008 mcb 1P 16A", variants: [], priority: true, yellow: true },
    { name: "SP-0077 Automatic heater", variants: [], priority: true, yellow: true },
    { name: "SP-0080 Base light", variants: [], priority: true, yellow: true },
    { name: "SP-0095 Box plastic dual", variants: [], priority: true, yellow: true },
    { name: "SP-0096 Box plastic Single", variants: [], priority: true, yellow: true },
    { name: "SP-0107 BS-008 TV OUT LET", variants: [], priority: true, yellow: true },
    { name: "SP-0118 Bulb 150w", variants: [], priority: true, yellow: true },
    { name: "SP-0119 Projector Light 50W-100W -150W", variants: [], priority: true, yellow: true },
    { name: "SP-0122 cable 10*4", variants: [], priority: true, yellow: true },
    { name: "SP-0123 cable 16*4", variants: [], priority: true, yellow: true },
    { name: "SP-0124 cable 2*0.75", variants: [], priority: true, yellow: true },
    { name: "SP-0125 Cable 2*1.5", variants: [], priority: true, yellow: true },
    { name: "SP-0126 cable 3*1.5", variants: [], priority: true, yellow: true },
    { name: "SP-0127 Cable 3*1.5", variants: [], priority: true, yellow: true },
    { name: "SP-0128 cable 3*2.5", variants: [], priority: true, yellow: true },
    { name: "SP-0129 cable 25*4 m", variants: [], priority: true, yellow: true },
    { name: "SP-0130 cable 4*4", variants: [], priority: true, yellow: true },
    { name: "SP-0131 cable 6*4", variants: [], priority: true, yellow: true },
    { name: "SP-0133 TV Wire", variants: [], priority: true, yellow: true },
    { name: "SP-0134 cable join 10mm", variants: [], priority: true, yellow: true },
    { name: "SP-0137 cable join 16mm", variants: [], priority: true, yellow: true },
    { name: "SP-0140 cable join 25mm", variants: [], priority: true, yellow: true },
    { name: "SP-0141 cable join 35mm", variants: [], priority: true, yellow: true },
    { name: "SP-0142 cable join 50mm", variants: [], priority: true, yellow: true },
    { name: "SP-0152 cable plug 3 line", variants: [], priority: true, yellow: true },
    { name: "SP-0153 cable tie", variants: [], priority: true, yellow: true },
    { name: "SP-0190 Circuit leakage 2P 25A", variants: [], priority: true, yellow: true },
    { name: "SP-0191 Circuit leakge 2P 40A", variants: [], priority: true, yellow: true },
    { name: "SP-0210 connector", variants: [], priority: true, yellow: true },
    { name: "SP-0211 connector join", variants: [], priority: true, yellow: true },
    { name: "SP-0228 cover16*16mm", variants: [], priority: true, yellow: true },
    { name: "SP-0232 Crown LED(18W)", variants: [], priority: true, yellow: true },
    { name: "SP-0275 earthline rod", variants: [], priority: true, yellow: true },
    { name: "SP-0345 Strip Lights", variants: [], priority: true, yellow: true },
    { name: "SP-0376 LC1D09M7 contactor", variants: [], priority: true, yellow: true },
    { name: "SP-0377 LC1D18M7 Contacter", variants: [], priority: true, yellow: true },
    { name: "SP-0378 LC1D32M7Contacter", variants: [], priority: true, yellow: true },
    { name: "SP-0383 LED 60*60", variants: [], priority: true, yellow: true },
    { name: "SP-0384 Led White Bulb 9W", variants: [], priority: true, yellow: true },
    { name: "SP-0386 Led tube 120cm", variants: [], priority: true, yellow: true },
    { name: "SP-0387 legrand 125A breaker 3p", variants: [], priority: true, yellow: true },
    { name: "SP-0390 legrand 63A breaker 3p", variants: [], priority: true, yellow: true },
    { name: "SP-0394 light sensor", variants: [], priority: true, yellow: true },
    { name: "SP-0399 LRD21", variants: [], priority: true, yellow: true },
    { name: "SP-0400 LRD22", variants: [], priority: true, yellow: true },
    { name: "SP-0401 LRD32", variants: [], priority: true, yellow: true },
    { name: "SP-0403 main Circuit 3P 40A", variants: [], priority: true, yellow: true },
    { name: "SP-0404 main Circuit 3P 63A", variants: [], priority: true, yellow: true },
    { name: "SP-0462 photo Cell", variants: [], priority: true, yellow: true },
    { name: "SP-0508 red electrical pipe 20mm", variants: [], priority: true, yellow: true },
    { name: "SP-0509 red electrical pipe 25mm", variants: [], priority: true, yellow: true },
    { name: "SP-0510 red electrical pipe 32mm", variants: [], priority: true, yellow: true },
    { name: "SP-0514 Roundly Switch Plug", variants: [], priority: true, yellow: true },
    { name: "SP-0525 schneider timer 24hr digital", variants: [], priority: true, yellow: true },
    { name: "SP-0530 Sginal Light", variants: [], priority: true, yellow: true },
    { name: "SP-0541 Single cable 1.5", variants: [], priority: true, yellow: true },
    { name: "SP-0542 Single cable 2.5", variants: [], priority: true, yellow: true },
    { name: "SP-0558 Switch bell", variants: [], priority: true, yellow: true },
    { name: "SP-0559 switch plug Dual", variants: [], priority: true, yellow: true },
    { name: "SP-0560 switch plug Dual-Apt", variants: [], priority: true, yellow: true },
    { name: "SP-0561 Switch plug joker", variants: [], priority: true, yellow: true },
    { name: "SP-0562 Switch plug round", variants: [], priority: true, yellow: true },
    { name: "SP-0563 switch plug Single", variants: [], priority: true, yellow: true },
    { name: "SP-0564 switch plug Single-Apt", variants: [], priority: true, yellow: true },
    { name: "SP-0565 Switch plug-water heater", variants: [], priority: true, yellow: true },
    { name: "SP-0571 tape", variants: [], priority: true, yellow: true },
    { name: "SP-0626 underground cable join 120mm", variants: [], priority: true, yellow: true },
    { name: "SP-0627 underground cable join 150mm", variants: [], priority: true, yellow: true },
    { name: "SP-0628 underground cable join 16mm", variants: [], priority: true, yellow: true },
    { name: "SP-0629 underground cable join 185mm", variants: [], priority: true, yellow: true },
    { name: "SP-0630 underground cable join 240mm", variants: [], priority: true, yellow: true },
    { name: "SP-0631 underground cable join 25mm", variants: [], priority: true, yellow: true },
    { name: "SP-0632 underground cable join 35mm", variants: [], priority: true, yellow: true },
    { name: "SP-0633 underground cable join 50mm", variants: [], priority: true, yellow: true },
    { name: "SP-0634 underground cable join 70mm", variants: [], priority: true, yellow: true },
    { name: "SP-0635 underground cable join 95mm", variants: [], priority: true, yellow: true },
    { name: "SP-0640 Ventilating Fan4", variants: [], priority: true, yellow: true },
    { name: "SP-0641 Ventilating Fan5", variants: [], priority: true, yellow: true },
    { name: "SP-0642 Ventilating Fan6", variants: [], priority: true, yellow: true },
    { name: "SP-0643 Ventilating Fan8", variants: [], priority: true, yellow: true },
    { name: "SP-0665 water proof elec. Box 11*11", variants: [], priority: true, yellow: true },
    { name: "SP-0709 Electrical Wire 3 x 1.5 mm", variants: [], priority: true, yellow: true },
    { name: "SP-0796 Main Circuit 3f25", variants: [], priority: true, yellow: true },
    { name: "SP-0797 Main Circuit 3f32", variants: [], priority: true, yellow: true },
    { name: "SP-0798 Main Circuit 3f40", variants: [], priority: true, yellow: true },
    { name: "SP-0842 Electrical Point Cover", variants: [], priority: true, yellow: true },
    { name: "SP-0860 Garden Light Blub Cover", variants: [], priority: true, yellow: true },
    { name: "SP-0862 Smart Meter with controller (Egyption)", variants: [], priority: true, yellow: true },
    { name: "SP-0894 push button Green BA31", variants: [], priority: true, yellow: true },
    { name: "SP-0895 push button red BA42", variants: [], priority: true, yellow: true },
    { name: "SP-0896 Switch 1-0-2 BD33", variants: [], priority: true, yellow: true },
    { name: "SP-0897 Circuit Breaker 2P 16A", variants: [], priority: true, yellow: true },
    { name: "SP-0898 Circuit Breaker 2P 20A", variants: [], priority: true, yellow: true },
    { name: "SP-0899 RCB 25A 4P 30ma", variants: [], priority: true, yellow: true },
    { name: "SP-0900 RCB 40A 4P 30ma", variants: [], priority: true, yellow: true },
    { name: "SP-0901 Circut Breaker MCCB 100A 3P", variants: [], priority: true, yellow: true },
    { name: "SP-0913 BOX 25 X 35", variants: [], priority: true, yellow: true },
    { name: "SP-0914 Box 30x40", variants: [], priority: true, yellow: true },
    { name: "SP-0915 Cable 2,5 x 2", variants: [], priority: true, yellow: true },
    { name: "SP-0916 Cable 4 x 3", variants: [], priority: true, yellow: true },
    { name: "SP-0917 Hose Cable 20m", variants: [], priority: true, yellow: true },
    { name: "SP-0918 Hose for Cable 25m", variants: [], priority: true, yellow: true },
    { name: "SP-0923 Electricity meter remote control", variants: [], priority: true, yellow: true },
    { name: "SP-0968 MCB 3P 16A", variants: [], priority: true, yellow: true },
    { name: "SP-0984 transformer A5 V18", variants: [], priority: true, yellow: true },
    { name: "SP-1016 Box 40*50 cm", variants: [], priority: true, yellow: true },
    { name: "SP-1048 Timer 24/7", variants: [], priority: true, yellow: true },
    { name: "SP-1049 Bell light overload", variants: [], priority: true, yellow: true },
    { name: "SP-1055 heat join cable 10MM", variants: [], priority: true, yellow: true },
    { name: "SP-1056 Heat join cable 16mm", variants: [], priority: true, yellow: true },
    { name: "SP-1057 Heat join cable 25mm", variants: [], priority: true, yellow: true },
    { name: "SP-1061 Power bank 12v,12A for LED liner", variants: [], priority: true, yellow: true },
    { name: "SP-1062 LED liner", variants: [], priority: true, yellow: true },
    { name: "SP-1063 Profile liner", variants: [], priority: true, yellow: true },
    { name: "SP-1075 Power supply", variants: [], priority: true, yellow: true },
    { name: "SP-1170 Cable single 1x16 earthly color", variants: [], priority: true, yellow: true },
    { name: "SP-1171 wire single 1x6 mix colors", variants: [], priority: true, yellow: true },
    { name: "SP-1172 wire single 1x4 mix colors", variants: [], priority: true, yellow: true },
    { name: "SP-1177 led 30w white", variants: [], priority: true, yellow: true },
    { name: "SP-1178 led 7w yellow", variants: [], priority: true, yellow: true },
    { name: "SP-1179 main 4p 100A schneider", variants: [], priority: true, yellow: true },
    { name: "SP-1180 main 4p 63A schneider", variants: [], priority: true, yellow: true },
    { name: "SP-1181 main 4p 32A schneider", variants: [], priority: true, yellow: true },
    { name: "SP-1182 exit sign", variants: [], priority: true, yellow: true },
    { name: "SP-1183 electric distribution board", variants: [], priority: true, yellow: true },
    { name: "SP-1189 Rechargeable battery for light", variants: [], priority: true, yellow: true },
    { name: "SP-1342 main Circuit 4P 25Amp", variants: [], priority: true, yellow: true },
    { name: "SP-1343 main Circuit 4P 32Amp", variants: [], priority: true, yellow: true },
    { name: "SP-1344 main Circuit 4P 40Amp", variants: [], priority: true, yellow: true },
    { name: "SP-1421 Cable Jointing Waterproof", variants: [], priority: true, yellow: true },
    { name: "SP-1422 Rotating spotlight 15W 4000K", variants: [], priority: true, yellow: true },
    { name: "SP-1434 Door lock for electric board", variants: [], priority: true, yellow: true },
    { name: "SP-1435 Power Supply 12V – 5A", variants: [], priority: true, yellow: true },
    { name: "SP-1436 busbar electrical 2p+p3", variants: [], priority: true, yellow: true },
    { name: "SP-0003 main breakerA9R41463", variants: [], priority: true },
    { name: "SP-0006 mcb 1P 32A", variants: [], priority: true },
    { name: "SP-0007 mcb 1P 6A", variants: [], priority: true },
    { name: "SP-0009 mcb 1P 4A", variants: [], priority: true },
    { name: "SP-0010 Steel Zip Ties 20mm", variants: [], priority: true },
    { name: "SP-0011 Steel Zip Ties 25mm", variants: [], priority: true },
    { name: "SP-0108 BS-009", variants: [], priority: true },
    { name: "SP-0109 BS-010", variants: [], priority: true },
    { name: "SP-0120 Bulb holder 60*60", variants: [], priority: true },
    { name: "SP-0135 cable join 120mm", variants: [], priority: true },
    { name: "SP-0136 cable join 150mm", variants: [], priority: true },
    { name: "SP-0138 cable join 185mm", variants: [], priority: true },
    { name: "SP-0139 cable join 240mm", variants: [], priority: true },
    { name: "SP-0143 cable join 6mm", variants: [], priority: true },
    { name: "SP-0144 cable join 70mm", variants: [], priority: true },
    { name: "SP-0145 cable join 90mm", variants: [], priority: true },
    { name: "SP-0146 Cable pipe 20mm", variants: [], priority: true },
    { name: "SP-0147 Cable pipe 25mm", variants: [], priority: true },
    { name: "SP-0148 Cable pipe elbow 20mm", variants: [], priority: true },
    { name: "SP-0149 Cable pipe elbow 25mm", variants: [], priority: true },
    { name: "SP-0150 Cable pipe join 20mm", variants: [], priority: true },
    { name: "SP-0151 Cable pipe join 25mm", variants: [], priority: true },
    { name: "SP-0154 Cable Terminal 15mm", variants: [], priority: true },
    { name: "SP-0156 cable tray 20*70", variants: [], priority: true },
    { name: "SP-0157 Cable tray 5*5", variants: [], priority: true },
    { name: "SP-0158 cable Zip tie", variants: [], priority: true },
    { name: "SP-0159 cable Zip tie 10mm", variants: [], priority: true },
    { name: "SP-0160 cable Zip tie 20mm", variants: [], priority: true },
    { name: "SP-0161 cable Zip tie 8mm", variants: [], priority: true },
    { name: "SP-0163 capacitor 400w", variants: [], priority: true },
    { name: "SP-0212 Contacter UMC50", variants: [], priority: true },
    { name: "SP-0213 Contacter UMC9", variants: [], priority: true },
    { name: "SP-0223 cover 12*12mm", variants: [], priority: true },
    { name: "SP-0224 Cover 25*40mm", variants: [], priority: true },
    { name: "SP-0226 cover10*20mm", variants: [], priority: true },
    { name: "SP-0227 cover12*25mm", variants: [], priority: true },
    { name: "SP-0233 CT cable", variants: [], priority: true },
    { name: "SP-0243 Door bell", variants: [], priority: true },
    { name: "SP-0276 Elec meter-used", variants: [], priority: true },
    { name: "SP-0277 Elec proof Glove", variants: [], priority: true },
    { name: "SP-0280 Electrical Junction 25mm", variants: [], priority: true },
    { name: "SP-0281 Electrical lighting Barcket 60x60", variants: [], priority: true },
    { name: "SP-0282 Electrical points scrows", variants: [], priority: true },
    { name: "SP-0283 EMERGENCY LIGHT", variants: [], priority: true },
    { name: "SP-0285 External fence brackets", variants: [], priority: true },
    { name: "SP-0346 Holder", variants: [], priority: true },
    { name: "SP-0347 holder", variants: [], priority: true },
    { name: "SP-0348 holder 400w", variants: [], priority: true },
    { name: "SP-0368 Junction box 4way 20mm", variants: [], priority: true },
    { name: "SP-0369 Junction box 4way 25mm", variants: [], priority: true },
    { name: "SP-0379 LC1D50AM7", variants: [], priority: true },
    { name: "SP-0380 LC1K1610M7", variants: [], priority: true },
    { name: "SP-0381 Led 12w crown", variants: [], priority: true },
    { name: "SP-0382 Led 12w horoz", variants: [], priority: true },
    { name: "SP-0385 Led lamp yellow", variants: [], priority: true },
    { name: "SP-0388 legrand 250A breaker 3p", variants: [], priority: true },
    { name: "SP-0389 legrand 40A breaker 3p", variants: [], priority: true },
    { name: "SP-0392 light bulb 400w", variants: [], priority: true },
    { name: "SP-0393 Light Pole", variants: [], priority: true },
    { name: "SP-0402 LV430311", variants: [], priority: true },
    { name: "SP-0413 mcb 1P 40A", variants: [], priority: true },
    { name: "SP-0414 mcb 1P 10A", variants: [], priority: true },
    { name: "SP-0415 Metal Box", variants: [], priority: true },
    { name: "SP-0430 Nail-elec", variants: [], priority: true },
    { name: "SP-0436 Neon light 60cm", variants: [], priority: true },
    { name: "SP-0469 Pipe-20mm", variants: [], priority: true },
    { name: "SP-0470 Pipe-35mm", variants: [], priority: true },
    { name: "SP-0491 Projector lamb", variants: [], priority: true },
    { name: "SP-0512 RM17TG20 Phase Failure", variants: [], priority: true },
    { name: "SP-0517 RUMC31P7", variants: [], priority: true },
    { name: "SP-0522 Salt for RO System", variants: [], priority: true },
    { name: "SP-0566 Switch-13A", variants: [], priority: true },
    { name: "SP-0567 Switch-quatro", variants: [], priority: true },
    { name: "SP-0569 Tap holder", variants: [], priority: true },
    { name: "SP-0624 transformer 400w", variants: [], priority: true },
    { name: "SP-0625 Transformer bell", variants: [], priority: true },
    { name: "SP-0646 Visital Lamp", variants: [], priority: true },
    { name: "SP-0666 water proof elec. Box 14*14", variants: [], priority: true },
    { name: "SP-0667 water proof elec. Box 18*11", variants: [], priority: true },
    { name: "SP-0668 water proof elec. Box 18*18", variants: [], priority: true },
    { name: "SP-0669 water proof elec. Box 23*12", variants: [], priority: true },
    { name: "SP-0670 water proof elec. Box 27*18", variants: [], priority: true },
    { name: "SP-0671 water proof elec. Box 8*8", variants: [], priority: true },
    { name: "SP-0692 WW electric meter", variants: [], priority: true },
    { name: "SP-0693 Electric PVC stand", variants: [], priority: true },
    { name: "SP-0694 Electrical junction - single 25 mm", variants: [], priority: true },
    { name: "SP-0695 Electrical junction - Dual 25 mm", variants: [], priority: true },
    { name: "SP-0696 Electrical joints 25 mm", variants: [], priority: true },
    { name: "SP-0697 Electrical box single - steel", variants: [], priority: true },
    { name: "SP-0702 Light projectors", variants: [], priority: true },
    { name: "SP-0710 Electrical Wire 2x1.5", variants: [], priority: true },
    { name: "SP-0711 Rainforcment cable 1 x 300 mm", variants: [], priority: true },
    { name: "SP-0730 Box-Metal Dual", variants: [], priority: true },
    { name: "SP-0731 PVC - Holder", variants: [], priority: true },
    { name: "SP-0732 Electrical box single - PVC", variants: [], priority: true },
    { name: "SP-0741 Alchemica - Primer - Greece", variants: [], priority: true },
    { name: "SP-0754 spotlight lamp 18 Watts", variants: [], priority: true },
    { name: "SP-0756 Nion light 4 feet", variants: [], priority: true },
    { name: "SP-0757 Cable 10x5", variants: [], priority: true },
    { name: "SP-0795 Cable 5 x 25 mm", variants: [], priority: true },
    { name: "SP-0799 Holder Well White", variants: [], priority: true },
    { name: "SP-0802 Magnet Sensor(loop)2 line", variants: [], priority: true },
    { name: "SP-0843 LED Strip Transformer", variants: [], priority: true },
    { name: "SP-0847 Light bulb 20 watt", variants: [], priority: true },
    { name: "SP-0848 |light Bulb 30 watt", variants: [], priority: true },
    { name: "SP-0861 Home Doorphone unit system", variants: [], priority: true },
    { name: "SP-0911 LRD1417-10", variants: [], priority: true },
    { name: "SP-0912 LCID 25M7", variants: [], priority: true },
    { name: "SP-0919 light bulb 150w", variants: [], priority: true },
    { name: "SP-0920 capacitor 150w", variants: [], priority: true },
    { name: "SP-0921 holder 150w", variants: [], priority: true },
    { name: "SP-0922 transformer 150w", variants: [], priority: true },
    { name: "SP-0928 Yellow Garden Light 1m*15cm", variants: [], priority: true },
    { name: "SP-0979 Smart Door Lock", variants: [], priority: true },
    { name: "SP-0980 Yellow Light Projector", variants: [], priority: true },
    { name: "SP-0983 Transformer For Strip LED", variants: [], priority: true },
    { name: "SP-0991 Box plastic dual / Used", variants: [], priority: true },
    { name: "SP-0993 capacitor 400w / Used", variants: [], priority: true },
    { name: "SP-0999 WW electric meter / Used", variants: [], priority: true },
    { name: "SP-1002 Lighting Circuit Cover", variants: [], priority: true },
    { name: "SP-1004 cable 2*4mm", variants: [], priority: true },
    { name: "SP-1005 cable 3*95mm", variants: [], priority: true },
    { name: "SP-1006 well lamp", variants: [], priority: true },
    { name: "SP-1011 flash lamp", variants: [], priority: true },
    { name: "SP-1017 Three bolts copper to aluminum clips", variants: [], priority: true },
    { name: "SP-1018 Three bolts aluminum to aluminum clips", variants: [], priority: true },
    { name: "SP-1042 CT Meter (ISKRA)", variants: [], priority: true },
    { name: "SP-1047 Switch mini overload (6-10)(10.-20)A", variants: [], priority: true },
    { name: "SP-1050 Cable Waire 1mm", variants: [], priority: true },
    { name: "SP-1052 LED pole 3mm ww", variants: [], priority: true },
    { name: "SP-1053 Over load for conductor D.50", variants: [], priority: true },
    { name: "SP-1054 Black box+plumbic +BG single", variants: [], priority: true },
    { name: "SP-1058 Spot light 12w white 8cm back", variants: [], priority: true },
    { name: "SP-1059 Spot light 20w white 10cm back", variants: [], priority: true },
    { name: "SP-1060 Spot light square veto 6w yellow", variants: [], priority: true },
    { name: "SP-1074 Garden fixture GOYA brand 5w", variants: [], priority: true },
    { name: "SP-1076 Cable 4*120mm", variants: [], priority: true },
    { name: "SP-1094 Led Light Garden", variants: [], priority: true },
    { name: "SP-1169 dayzek system", variants: [], priority: true },
    { name: "SP-1184 city time", variants: [], priority: true },
    { name: "SP-1187 Power Supply 12V – 2A", variants: [], priority: true },
    { name: "SP-1188 Rechargeable battery for Motor cycle", variants: [], priority: true },
    { name: "SP-1334 mcb 1P 3A", variants: [], priority: true },
    { name: "SP-1335 Overload Switch 18amp", variants: [], priority: true },
    { name: "SP-1336 Overload Switch 24amp", variants: [], priority: true },
    { name: "SP-1337 Overload Switch 32amp", variants: [], priority: true },
    { name: "SP-1338 TENSE HSR -22 HYDROPHOR-2PUMP", variants: [], priority: true },
    { name: "SP-1339 TENSE HSR -22 HYDROPHOR-3PUMP", variants: [], priority: true },
    { name: "SP-1340 TENSE HSR -22 HYDROPHOR-4PUMP", variants: [], priority: true },
    { name: "SP-1420 Heat Shrink Tubing", variants: [], priority: true }
  ];

  function formatSelection(name, variant) {
    var v = String(variant || '').trim();
    return v ? (name + ' ' + v) : name;
  }

  function formatSelectionWithQty(name, variant, qty) {
    var label = formatSelection(name, variant);
    var q = parseFloat(qty);
    if (isNaN(q) || q <= 0) q = 1;
    if (Math.abs(q - Math.round(q)) < 0.0001) q = Math.round(q);
    else q = Math.round(q * 100) / 100;
    return q + ' \u00d7 ' + label;
  }

  function parseMaterialLine(line) {
    line = String(line || '').trim();
    if (!line) return null;
    var m = line.match(/^(\d+(?:\.\d+)?)\s*(?:[x×]\s*)?(.+)$/i);
    if (m) {
      var qty = parseFloat(m[1]);
      var name = String(m[2] || '').trim();
      if (!name || isNaN(qty) || qty <= 0) return null;
      return { qty: qty, name: name };
    }
    return { qty: 1, name: line };
  }

  function parseMaterialsText(text) {
    var out = [];
    String(text || '').split(/\r?\n|,/).forEach(function (part) {
      var item = parseMaterialLine(part);
      if (item) out.push(item);
    });
    return out;
  }

  function aggregateMaterialsUsage(texts) {
    var totals = {};
    (texts || []).forEach(function (text) {
      parseMaterialsText(text).forEach(function (item) {
        var key = item.name;
        if (!totals[key]) totals[key] = 0;
        totals[key] += item.qty;
      });
    });
    return Object.keys(totals).sort(function (a, b) {
      return totals[b] - totals[a] || a.localeCompare(b);
    }).map(function (name) {
      var qty = totals[name];
      return {
        name: name,
        qty: Math.abs(qty - Math.round(qty)) < 0.0001 ? Math.round(qty) : Math.round(qty * 100) / 100
      };
    });
  }

  function appendToInput(input, text) {
    if (!input || !text) return;
    var cur = String(input.value || '').trim();
    var sep = ', ';
    input.value = cur ? (cur + sep + text) : text;
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}
    input.focus();
    if (input.tagName === 'TEXTAREA' && typeof input.scrollTop !== 'undefined') {
      input.scrollTop = input.scrollHeight;
    }
  }

  function promptMaterialQuantity(label, onConfirm) {
    var existing = document.getElementById('empireMatQtySheet');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = 'empireMatQtySheet';
    wrap.className = 'empire-mat-qty-sheet';
    wrap.innerHTML =
      '<div class="empire-mat-qty-backdrop" data-close="1"></div>'
      + '<div class="empire-mat-qty-panel" role="dialog" aria-label="Material quantity">'
      + '<p class="empire-mat-qty-title">How many?</p>'
      + '<p class="empire-mat-qty-label">' + escHtml(label) + '</p>'
      + '<input type="number" id="empireMatQtyInput" class="empire-mat-qty-input" value="1" min="0.01" step="1" inputmode="decimal">'
      + '<div class="empire-mat-qty-actions">'
      + '<button type="button" class="empire-mat-qty-add" data-add="1">Add to list</button>'
      + '<button type="button" class="empire-mat-qty-cancel" data-close="1">Cancel</button>'
      + '</div></div>';
    document.body.appendChild(wrap);
    var input = wrap.querySelector('#empireMatQtyInput');
    function close() { wrap.remove(); }
    function submit() {
      var qty = input ? parseFloat(input.value) : 1;
      if (isNaN(qty) || qty <= 0) qty = 1;
      close();
      if (typeof onConfirm === 'function') onConfirm(qty);
    }
    wrap.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    wrap.querySelector('[data-add]').addEventListener('click', submit);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      setTimeout(function () { input.focus(); input.select(); }, 30);
    }
  }

  function addMaterialWithQty(input, name, variant) {
    var label = formatSelection(name, variant);
    promptMaterialQuantity(label, function (qty) {
      appendToInput(input, formatSelectionWithQty(name, variant, qty));
    });
  }

  function normalizeMaterialsList(text) {
    var items = parseMaterialsText(text);
    if (!items.length) return String(text || '').trim();
    return items.map(function (item) {
      var q = item.qty;
      if (Math.abs(q - Math.round(q)) < 0.0001) q = Math.round(q);
      else q = Math.round(q * 100) / 100;
      return q + ' \u00d7 ' + item.name;
    }).join(', ');
  }

  function buildPickerHtml(catalog) {
    catalog = catalog || CATALOG;
    var rows = catalog.map(function (item, idx) {
      var hasVar = item.variants && item.variants.length > 0;
      var hint = hasVar ? ('<span class="mat-hint">' + item.variants.join(', ') + '</span>') : '';
      var variantsHtml = hasVar
        ? item.variants.map(function (v) {
          return '<button type="button" class="empire-mat-variant" data-name="' + escAttr(item.name) + '" data-variant="' + escAttr(v) + '">' + escHtml(v) + '</button>';
        }).join('')
        : '';
      var rowClass = 'empire-mat-row'
        + (hasVar ? ' has-variants' : '')
        + (item.red ? ' empire-mat-red' : '')
        + (item.yellow ? ' empire-mat-yellow' : '')
        + (item.priority ? ' empire-mat-priority' : '');
      return '<div class="' + rowClass + '" data-search="' + escAttr((idx + 1) + ' ' + item.name + ' ' + (item.variants || []).join(' ')) + '">'
        + '<button type="button" class="empire-mat-name"' + (hasVar ? '' : ' data-name="' + escAttr(item.name) + '" data-variant=""') + '>'
        + '<span>' + escHtml((idx + 1) + '. ' + item.name) + '</span>' + hint + '</button>'
        + (hasVar ? ('<div class="empire-mat-variants">' + variantsHtml + '</div>') : '')
        + '</div>';
    }).join('');
    return '<button type="button" class="empire-materials-picker-toggle" aria-expanded="false">'
      + '<span>Add material from list</span><span class="chev" aria-hidden="true">&#9662;</span></button>'
      + '<div class="empire-materials-picker-panel">'
      + '<input type="search" class="empire-materials-search" placeholder="Search materials…" autocomplete="off">'
      + '<div class="empire-materials-list">' + rows + '</div>'
      + '<p class="empire-materials-picker-hint">Tap a material, enter a quantity, then it is added with a comma between each item. Totals appear in Analytics at month end.</p>'
      + '</div>';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function bindPicker(picker, input) {
    var toggle = picker.querySelector('.empire-materials-picker-toggle');
    var search = picker.querySelector('.empire-materials-search');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = picker.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && search) search.focus();
      });
    }
    if (search) {
      search.addEventListener('input', function () {
        var q = String(search.value || '').trim().toLowerCase();
        picker.querySelectorAll('.empire-mat-row').forEach(function (row) {
          var hay = String(row.getAttribute('data-search') || '').toLowerCase();
          row.classList.toggle('hidden', q && hay.indexOf(q) === -1);
        });
      });
    }
    picker.querySelectorAll('.empire-mat-name').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.empire-mat-row');
        if (row && row.classList.contains('has-variants')) {
          var wasOpen = row.classList.contains('expanded');
          picker.querySelectorAll('.empire-mat-row.expanded').forEach(function (r) {
            if (r !== row) r.classList.remove('expanded');
          });
          row.classList.toggle('expanded', !wasOpen);
          return;
        }
        addMaterialWithQty(input, btn.getAttribute('data-name'), btn.getAttribute('data-variant'));
      });
    });
    picker.querySelectorAll('.empire-mat-variant').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        addMaterialWithQty(input, btn.getAttribute('data-name'), btn.getAttribute('data-variant'));
        var row = btn.closest('.empire-mat-row');
        if (row) row.classList.remove('expanded');
      });
    });
  }

  function resolveCatalog(opts) {
    opts = opts || {};
    if (opts.catalog && opts.catalog.length) return opts.catalog;
    if (window.EMPIRE_MATERIALS_CATALOG && window.EMPIRE_MATERIALS_CATALOG.length) {
      return window.EMPIRE_MATERIALS_CATALOG;
    }
    return CATALOG;
  }

  function mount(inputId, opts) {
    opts = opts || {};
    var input = document.getElementById(inputId);
    if (!input || input.dataset.empireMaterialsPicker === '1') return null;
    input.dataset.empireMaterialsPicker = '1';
    var picker = document.createElement('div');
    picker.className = 'empire-materials-picker';
    picker.innerHTML = buildPickerHtml(resolveCatalog(opts));
    if (input.nextSibling) input.parentNode.insertBefore(picker, input.nextSibling);
    else input.parentNode.appendChild(picker);
    bindPicker(picker, input);
    if (opts.autoOpen) {
      picker.classList.add('open');
      var toggle = picker.querySelector('.empire-materials-picker-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    return picker;
  }

  window.EMPIRE_ELECTRICAL_MATERIALS = CATALOG;
  window.empireMaterialsPickerMount = mount;
  window.empireMaterialsFormatSelection = formatSelection;
  window.empireMaterialsFormatSelectionWithQty = formatSelectionWithQty;
  window.empireMaterialsParseText = parseMaterialsText;
  window.empireMaterialsAggregateUsage = aggregateMaterialsUsage;
  window.empireMaterialsNormalizeList = normalizeMaterialsList;
})();
