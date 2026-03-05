# Bambu Lab Integration & Testing Guide

This guide explains how to integrate with Bambu Lab printers and test local slicing, queuing, and farm management.

## Overview

Bambu Lab provides several ways to integrate with their printers:
1. **Bambu Connect** - Cloud-based integration
2. **Local API** - Direct network communication with printers
3. **Bambu Studio CLI** - Command-line slicing
4. **FTP Server** - Direct file transfer to printer

## Prerequisites

- Bambu Lab X1 Carbon, P1P, P1S, or A1 series printer
- Printer connected to your local network
- Bambu Studio installed on your computer
- Printer firmware up to date

## Option 1: Bambu Connect (Cloud API)

### Step 1: Get API Access

1. Create a Bambu Lab account at [https://bambulab.com](https://bambulab.com)
2. Log in to Bambu Studio
3. Enable **Developer Mode** in Settings
4. Generate an API key from your account dashboard

### Step 2: Find Your Printer

1. Open Bambu Studio
2. Go to **Device** → **Manage Devices**
3. Note your printer's:
   - **Serial Number**
   - **Device ID**
   - **Access Code** (found in printer settings)

### Step 3: Set Environment Variables

Add to `.env.local`:

```env
BAMBU_API_KEY=your_api_key_here
BAMBU_DEVICE_ID=your_device_id_here
BAMBU_ACCESS_CODE=your_access_code_here
```

### Step 4: Update API Routes

Modify `src/app/api/printers/route.ts` to fetch real printer data:

```typescript
import { NextResponse } from 'next/server'

const BAMBU_API_URL = 'https://api.bambulab.com/v1'

export async function GET() {
    const response = await fetch(`${BAMBU_API_URL}/devices`, {
        headers: {
            'Authorization': `Bearer ${process.env.BAMBU_API_KEY}`
        }
    })
    
    const data = await response.json()
    return NextResponse.json({ printers: data })
}
```

## Option 2: Local Network Integration (Recommended)

### Step 1: Enable LAN Mode

1. On your printer, go to **Settings** → **Network**
2. Note the printer's **IP address** (e.g., `192.168.1.100`)
3. Enable **LAN Mode** if available
4. Generate an **Access Code** if not already done

### Step 2: Test Connection

```bash
# Test if printer is accessible
ping 192.168.1.100

# Test HTTP endpoint (if supported)
curl http://192.168.1.100:8080/api/status
```

### Step 3: MQTT Communication

Bambu printers use MQTT for real-time communication:

```bash
npm install mqtt
```

Then create `src/lib/bambuMQTT.ts`:

```typescript
import mqtt from 'mqtt'

const PRINTER_IP = process.env.BAMBU_PRINTER_IP!
const ACCESS_CODE = process.env.BAMBU_ACCESS_CODE!

export function connectToPrinter() {
    const client = mqtt.connect(`mqtt://${PRINTER_IP}:1883`, {
        username: 'bblp',
        password: ACCESS_CODE
    })
    
    client.on('connect', () => {
        console.log('Connected to Bambu printer')
        client.subscribe('device/+/report')
    })
    
    client.on('message', (topic, message) => {
        const data = JSON.parse(message.toString())
        console.log('Printer status:', data)
    })
    
    return client
}
```

## Option 3: Bambu Studio Slicing (CLI)

### Step 1: Locate Bambu Studio Executable

Windows:
```
C:\Program Files\BambuStudio\bambu-studio.exe
```

Mac:
```
/Applications/BambuStudio.app/Contents/MacOS/BambuStudio
```

### Step 2: CLI Slicing

```bash
# Slice an STL file
bambu-studio-console.exe --export-gcode --load config.ini input.stl
```

### Step 3: Automate in Next.js

Create `src/app/api/slice/route.ts`:

```typescript
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    // Save STL temporarily
    const tempPath = `/tmp/${file.name}`
    // ... save file logic ...
    
    // Run slicer
    const cmd = `bambu-studio-console --export-gcode ${tempPath}`
    const { stdout } = await execAsync(cmd)
    
    // Read generated G-code
    // Return to client
}
```

## Option 4: Direct FTP Upload

Some Bambu printers support FTP for file transfer:

```typescript
import ftp from 'basic-ftp'

export async function uploadToPrinter(gcodeFile: string) {
    const client = new ftp.Client()
    
    try {
        await client.access({
            host: process.env.BAMBU_PRINTER_IP,
            user: 'bblp',
            password: process.env.BAMBU_ACCESS_CODE
        })
        
        await client.uploadFrom(gcodeFile, '/sdcard/prints/file.gcode')
    } finally {
        client.close()
    }
}
```

## Testing Workflow

### 1. Printer Discovery

Test printer connectivity:

```bash
curl http://localhost:3000/api/printers
```

Expected response:
```json
{
    "printers": [
        {
            "id": "printer-001",
            "name": "Bambu X1 Carbon",
            "status": "available",
            "ip": "192.168.1.100"
        }
    ]
}
```

### 2. File Upload & Slicing

```bash
curl -X POST http://localhost:3000/api/slice \
  -F "file=@model.stl" \
  -F "material=PLA" \
  -F "layerHeight=0.2"
```

### 3. Print Queue

```bash
curl -X POST http://localhost:3000/api/printers \
  -H "Content-Type: application/json" \
  -d '{
    "printerId": "printer-001",
    "fileName": "model.stl",
    "material": "PLA"
  }'
```

## Real-Time Status Updates

For live printer status, use Server-Sent Events (SSE):

```typescript
// src/app/api/printer-status/route.ts
export async function GET(request: Request) {
    const stream = new ReadableStream({
        start(controller) {
            // Connect to printer MQTT
            // Send updates via controller.enqueue()
        }
    })
    
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    })
}
```

## Environment Variables Summary

Add these to `.env.local`:

```env
# Bambu Lab Settings
BAMBU_API_KEY=your_api_key_here
BAMBU_PRINTER_IP=192.168.1.100
BAMBU_DEVICE_ID=device_id_here
BAMBU_ACCESS_CODE=access_code_from_printer
BAMBU_STUDIO_PATH="C:/Program Files/BambuStudio/bambu-studio.exe"
```

## Troubleshooting

### Can't connect to printer
- Check printer is on same network
- Verify IP address is correct
- Ensure LAN mode is enabled
- Check firewall settings

### MQTT connection fails
- Verify access code is correct
- Check port 1883 is not blocked
- Try restarting the printer

### Slicing fails
- Check Bambu Studio is installed
- Verify path to executable
- Ensure STL file is valid

## Security Considerations

> [!WARNING]
> **Never expose printer access codes publicly!**

1. Store all credentials in `.env.local`
2. Don't commit `.env.local` to Git
3. Use server-side API routes only
4. Implement authentication before allowing print jobs

## Next Steps

1. Implement real printer discovery
2. Add live status monitoring
3. Create print queue dashboard
4. Add job cancellation
5. Implement filament tracking

## Additional Resources

- [Bambu Lab API Documentation](https://github.com/bambulab/BambuStudio)
- [MQTT Protocol](https://mqtt.org/)
- [Bambu Studio GitHub](https://github.com/bambulab/BambuStudio)
