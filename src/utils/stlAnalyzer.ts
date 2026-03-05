import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'

export interface STLParameters {
    dimensions: {
        x: number // mm
        y: number // mm
        z: number // mm
    }
    volume: number // cm³
    weight: number // grams
    totalLayers?: number
    surfaceArea?: number // cm²
}

/**
 * Analyze an STL geometry and extract parameters
 */
export function analyzeGeometry(geometry: THREE.BufferGeometry, materialDensity: number): STLParameters {
    // Compute bounding box
    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!

    // Calculate dimensions in mm
    const dimensions = {
        x: Math.round((bbox.max.x - bbox.min.x) * 10) / 10,
        y: Math.round((bbox.max.y - bbox.min.y) * 10) / 10,
        z: Math.round((bbox.max.z - bbox.min.z) * 10) / 10,
    }

    // Calculate volume using signed volume of triangles
    const volume = calculateVolume(geometry)

    // Calculate weight based on material density
    const weight = Math.round(volume * materialDensity * 100) / 100

    return {
        dimensions,
        volume: Math.round(volume * 100) / 100,
        weight,
    }
}

/**
 * Calculate the volume of a mesh using the signed volume method
 * Volume is returned in cm³
 */
function calculateVolume(geometry: THREE.BufferGeometry): number {
    const position = geometry.attributes.position
    let volume = 0

    // Iterate through triangles
    for (let i = 0; i < position.count; i += 3) {
        const v1 = new THREE.Vector3(
            position.getX(i),
            position.getY(i),
            position.getZ(i)
        )
        const v2 = new THREE.Vector3(
            position.getX(i + 1),
            position.getY(i + 1),
            position.getZ(i + 1)
        )
        const v3 = new THREE.Vector3(
            position.getX(i + 2),
            position.getY(i + 2),
            position.getZ(i + 2)
        )

        // Signed volume of tetrahedron formed by triangle and origin
        volume += signedVolumeOfTriangle(v1, v2, v3)
    }

    // Convert from units³ to cm³ (assuming STL units are in mm)
    return Math.abs(volume) / 1000
}

/**
 * Calculate signed volume of tetrahedron formed by triangle and origin
 */
function signedVolumeOfTriangle(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): number {
    return p1.dot(p2.clone().cross(p3)) / 6.0
}

/**
 * Load and analyze an STL file
 */
export async function loadAndAnalyzeSTL(url: string, materialDensity: number): Promise<{
    geometry: THREE.BufferGeometry
    parameters: STLParameters
}> {
    return new Promise((resolve, reject) => {
        const loader = new STLLoader()
        loader.load(
            url,
            (geometry: THREE.BufferGeometry) => {
                const parameters = analyzeGeometry(geometry, materialDensity)
                resolve({ geometry, parameters })
            },
            undefined,
            (error: unknown) => reject(error)
        )
    })
}

/**
 * Format file size from bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
