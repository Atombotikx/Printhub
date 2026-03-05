G21 ; metric values
G90 ; absolute positioning
M107 ; start with the fan off
G28 X0 Y0 ; move X/Y to min endstops
G28 Z0 ; move Z to min endstops
G1 Z15.0 F9000 ; move the platform down 15mm
G92 E0 ; zero the extruded length
G1 F200 E3 ; extrude 3mm of feed stock
G92 E0 ; zero the extruded length again
G1 F9000
M117 Printing...
; Layer 1
G1 X50 Y50 Z0.3 F3000
G1 X150 Y50 E10
G1 X150 Y150 E20
G1 X50 Y150 E30
G1 X50 Y50 E40
; End of Gcode
