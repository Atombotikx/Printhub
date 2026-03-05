import * as THREE from 'three'

/**
 * Advanced cost estimation with support material calculation
 * This replaces the Polar3D estimate3d (which is archived/Perl only)
 */

export interface SupportEstimate {
    supportVolume: number // cm³
    supportWeight: number // grams
    modelVolume: number // cm³
    modelWeight: number // grams
    totalVolume: number // cm³
    totalWeight: number // grams
    supportPercentage: number // 0-100
}

/**
 * Estimate support material needed based on geometry analysis
 * Uses heuristics to determine overhang angles and unsupported areas
 */
export function estimateSupportMaterial(
    geometry: THREE.BufferGeometry,
    materialDensity: number,
    supportDensity: number = 0.15 // 15% infill for supports
): SupportEstimate {
    // Calculate model volume
    const modelVolume = calculateVolume(geometry)
    const modelWeight = modelVolume * materialDensity

    // Analyze geometry for overhangs
    const overhangData = analyzeOverhangs(geometry)

    // Estimate support volume based on overhang analysis
    const supportVolume = estimateSupportVolume(
        geometry,
        overhangData,
        supportDensity
    )

    const supportWeight = supportVolume * materialDensity * supportDensity

    return {
        supportVolume,
        supportWeight,
        modelVolume,
        modelWeight,
        totalVolume: modelVolume + supportVolume,
        totalWeight: modelWeight + supportWeight,
        supportPercentage: (supportVolume / modelVolume) * 100
    }
}

/**
 * Calculate volume of mesh using signed volume method
 */
function calculateVolume(geometry: THREE.BufferGeometry): number {
    const position = geometry.attributes.position
    let volume = 0

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

        volume += signedVolumeOfTriangle(v1, v2, v3)
    }

    // Convert from units³ to cm³ (assuming STL units are in mm)
    return Math.abs(volume) / 1000
}

function signedVolumeOfTriangle(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3
): number {
    return p1.dot(p2.clone().cross(p3)) / 6.0
}

interface OverhangData {
    overhangArea: number // mm²
    unsupportedTriangles: number
    averageOverhangAngle: number // degrees
    needsSupport: boolean
}

/**
 * Analyze geometry for overhangs that need support
 * Faces with angle > 45° from vertical need support
 */
function analyzeOverhangs(geometry: THREE.BufferGeometry): OverhangData {
    geometry.computeVertexNormals()

    const position = geometry.attributes.position
    const normal = geometry.attributes.normal

    let overhangArea = 0
    let unsupportedTriangles = 0
    let totalOverhangAngle = 0

    const upVector = new THREE.Vector3(0, 0, 1) // Assuming Z is up
    const supportAngleThreshold = 45 // degrees

    for (let i = 0; i < position.count; i += 3) {
        // Get triangle vertices
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

        // Calculate triangle normal
        const edge1 = new THREE.Vector3().subVectors(v2, v1)
        const edge2 = new THREE.Vector3().subVectors(v3, v1)
        const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize()

        // Calculate angle from vertical
        const angle = Math.acos(Math.abs(faceNormal.dot(upVector))) * (180 / Math.PI)

        // If angle > threshold and normal points down, needs support
        if (angle > supportAngleThreshold && faceNormal.z < 0) {
            const area = edge1.cross(edge2).length() / 2
            overhangArea += area
            unsupportedTriangles++
            totalOverhangAngle += angle
        }
    }

    return {
        overhangArea,
        unsupportedTriangles,
        averageOverhangAngle: unsupportedTriangles > 0
            ? totalOverhangAngle / unsupportedTriangles
            : 0,
        needsSupport: unsupportedTriangles > 0
    }
}

/**
 * Estimate support volume based on overhang analysis
 * This is a simplified heuristic - real slicers are much more complex
 */
function estimateSupportVolume(
    geometry: THREE.BufferGeometry,
    overhangData: OverhangData,
    supportDensity: number
): number {
    if (!overhangData.needsSupport) {
        return 0
    }

    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!
    const modelHeight = bbox.max.z - bbox.min.z

    // Estimate support volume based on overhang area and model height
    // This is a rough approximation:
    // support_volume ≈ overhang_area × (average_height / 2) × support_density

    const avgSupportHeight = modelHeight * 0.3 // Supports typically go 30% of model height on average
    const supportVolume = (overhangData.overhangArea * avgSupportHeight) / 1000 // Convert mm³ to cm³

    // Apply density factor (supports are typically 10-20% infill)
    return supportVolume * supportDensity
}

/**
 * Convert USD to INR
 */
export const USD_TO_INR = 83.5 // Update this rate as needed
