import { useEffect, Suspense } from 'react'
import { useThree } from '@react-three/fiber'
import { useTexture, OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomData } from './RoomPage'

// ── Taille selon level ────────────────────────────────────────────────────────
const ROOM_HALF = [4, 6, 8]  // level 0/1/2 → demi-largeur

// ── Box helper ────────────────────────────────────────────────────────────────

function Box({
  position, size, color,
  castShadow = false, receiveShadow = false,
  emissive, emissiveIntensity = 0,
  transparent = false, opacity = 1,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  castShadow?: boolean
  receiveShadow?: boolean
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
}) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  )
}

// ── Camera isométrique ────────────────────────────────────────────────────────

function IsometricSetup({ half }: { half: number }) {
  const { camera } = useThree()
  const dist = half * 3

  useEffect(() => {
    camera.position.set(dist, dist * 0.83, dist)
    camera.lookAt(0, half * 0.37, 0)
  }, [camera, dist, half])

  return (
    <OrbitControls
      target={[0, half * 0.37, 0]}
      enablePan={false}
      enableZoom={false}
      minPolarAngle={Math.PI / 5}
      maxPolarAngle={Math.PI / 2.8}
      minAzimuthAngle={-Math.PI / 6}
      maxAzimuthAngle={Math.PI / 2.2}
    />
  )
}

// ── Éclairage ─────────────────────────────────────────────────────────────────

function Lighting({ ambiance }: { ambiance: 'day' | 'sunset' | 'night' }) {
  const cfg = {
    day:    { ambient: '#fff8f8', ambI: 1.1, dir: '#fff5e0', dirI: 1.4, pos: [6, 9, 6]   as [number,number,number] },
    sunset: { ambient: '#ffd4a0', ambI: 0.9, dir: '#ff8c4b', dirI: 1.1, pos: [10, 5, 4]  as [number,number,number] },
    night:  { ambient: '#1e1b4b', ambI: 0.25, dir: '#2d2060',dirI: 0.15, pos: [0, 6, 0]  as [number,number,number] },
  }[ambiance]

  return (
    <>
      <ambientLight color={cfg.ambient} intensity={cfg.ambI} />
      <directionalLight
        color={cfg.dir} intensity={cfg.dirI} position={cfg.pos}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5} shadow-camera-far={80}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20}  shadow-camera-bottom={-20}
      />
    </>
  )
}

// ── Shell (sol + murs) ────────────────────────────────────────────────────────

function RoomShell({ wallColor, floorColor, half }: { wallColor: string; floorColor: string; half: number }) {
  const dim = half * 2
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[dim, dim]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <mesh position={[0, half / 2, -half]} receiveShadow>
        <planeGeometry args={[dim, half]} />
        <meshStandardMaterial color={wallColor} side={THREE.FrontSide} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-half, half / 2, 0]} receiveShadow>
        <planeGeometry args={[dim, half]} />
        <meshStandardMaterial color={wallColor} side={THREE.FrontSide} />
      </mesh>
      {/* Plinthes */}
      <Box position={[0, 0.075, -half + 0.04]} size={[dim, 0.15, 0.08]} color="#e9d5ff" />
      <Box position={[-half + 0.04, 0.075, 0]} size={[0.08, 0.15, dim]} color="#e9d5ff" />
    </group>
  )
}

// ── Fenêtre ───────────────────────────────────────────────────────────────────

function Window({ half }: { half: number }) {
  const s = half / 4
  return (
    <group position={[2.0 * s, half * 0.57, -half + 0.03]}>
      <Box position={[0, 0, 0]} size={[1.7 * s, half * 0.5, 0.07]} color="#f3f4f6" castShadow />
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.45 * s, half * 0.43]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.55} emissive="#bfdbfe" emissiveIntensity={0.3} />
      </mesh>
      <Box position={[0, 0, 0.05]} size={[1.45 * s, 0.05, 0.02]} color="#f3f4f6" />
      <Box position={[0, 0, 0.05]} size={[0.05, half * 0.43, 0.02]} color="#f3f4f6" />
    </group>
  )
}

// ── Mobilier ──────────────────────────────────────────────────────────────────

function Bed({ half }: { half: number }) {
  const s = half / 4
  return (
    <group position={[2.5 * s, 0, -(half - 1.5)]}>
      <Box position={[0, 0.15, 0]} size={[2.0, 0.3, 3.2]} color="#c4a35a" castShadow receiveShadow />
      <Box position={[0, 0.42, 0]} size={[1.85, 0.28, 3.0]} color="#fef9f9" castShadow />
      <Box position={[0, 0.58, 0.35]} size={[1.85, 0.1, 2.2]} color="#fcd7e8" castShadow />
      <Box position={[0, 0.62, -1.25]} size={[1.2, 0.17, 0.5]} color="#fce7f3" castShadow />
      <Box position={[0, 0.95, -1.65]} size={[2.0, 1.1, 0.18]} color="#c4a35a" castShadow />
      <Box position={[0, 0.35, 1.65]} size={[1.8, 0.55, 0.15]} color="#c4a35a" castShadow />
    </group>
  )
}

function Desk({ half }: { half: number }) {
  const s = half / 4
  const legs: [number,number,number][] = [[-0.95,0,-0.35],[-0.95,0,0.35],[0.95,0,-0.35],[0.95,0,0.35]]
  return (
    <group position={[-1.0 * s, 0, -(half - 0.45)]}>
      <Box position={[0, 0.78, 0]} size={[2.2, 0.1, 0.9]} color="#c4a35a" castShadow />
      {legs.map((p, i) => <Box key={i} position={p} size={[0.1, 0.78, 0.1]} color="#a0785a" castShadow />)}
      <Box position={[0.3, 0.86, -0.1]} size={[0.7, 0.04, 0.5]} color="#374151" castShadow />
      <Box position={[0.3, 1.04, -0.34]} size={[0.68, 0.38, 0.03]} color="#1f2937" castShadow />
    </group>
  )
}

function Bookshelf({ half }: { half: number }) {
  const s = half / 4
  const bookColors = ['#f87171','#fb923c','#fbbf24','#4ade80','#60a5fa','#c084fc']
  return (
    <group position={[-(half - 0.3), 0, -1.5 * s]}>
      <Box position={[0, 1.5, 0]} size={[0.22, 3.0, 1.6]} color="#a0785a" castShadow receiveShadow />
      {[0.6, 1.2, 1.8, 2.4].map((y, i) => (
        <Box key={i} position={[0.12, y, 0]} size={[0.02, 0.07, 1.5]} color="#c4a35a" />
      ))}
      {[0,1,2,3].map(shelf =>
        bookColors.slice(0,5).map((color, bi) => (
          <Box key={`${shelf}-${bi}`} position={[0.14, shelf*0.6+0.3+0.1, -0.6+bi*0.28]} size={[0.05,0.38,0.22]} color={color} castShadow />
        ))
      )}
    </group>
  )
}

function Plant({ half }: { half: number }) {
  const s = half / 4
  return (
    <group position={[-(half - 1.0), 0, 2.5 * s]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.19, 0.5, 8]} />
        <meshStandardMaterial color="#c47c52" />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.04, 8]} />
        <meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.62, 6]} />
        <meshStandardMaterial color="#4a7c59" />
      </mesh>
      {[0,1,2,3,4,5].map(i => (
        <mesh key={i} position={[Math.cos(i*Math.PI/3)*0.28, 1.1+Math.sin(i*0.55)*0.12, Math.sin(i*Math.PI/3)*0.28]} castShadow>
          <sphereGeometry args={[0.23, 7, 7]} />
          <meshStandardMaterial color={i%2===0 ? '#5a9e54' : '#4a8a45'} />
        </mesh>
      ))}
    </group>
  )
}

function Rug({ half }: { half: number }) {
  const s = half / 4
  return (
    <group position={[0.5 * s, 0.005, 0.5 * s]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.5, 2.5]} />
        <meshStandardMaterial color="#f9a8d4" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.001]}>
        <ringGeometry args={[1.55, 1.75, 32]} />
        <meshStandardMaterial color="#c084fc" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

function Lamp({ half }: { half: number }) {
  const s = half / 4
  return (
    <group position={[3.5 * s, 0, 0.5 * s]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.1, 8]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.6, 6]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <coneGeometry args={[0.3, 0.4, 8, 1, true]} />
        <meshStandardMaterial color="#fde68a" side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 1.65, 0]} intensity={2.0} color="#fde68a" distance={5} decay={2} />
    </group>
  )
}

// ── Cadres photo ──────────────────────────────────────────────────────────────

function PhotoTexture({ url }: { url: string }) {
  const texture = useTexture(url)
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[0.88, 0.88]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}

function PhotoFrame({ position, photoUrl }: { position: [number,number,number]; photoUrl?: string }) {
  return (
    <group position={position}>
      <Box position={[0, 0, 0]} size={[1.08, 1.08, 0.06]} color="#c4a35a" />
      {photoUrl ? (
        <Suspense fallback={<Box position={[0,0,0.04]} size={[0.88,0.88,0.01]} color="#fdf2f8" />}>
          <PhotoTexture url={photoUrl} />
        </Suspense>
      ) : (
        <group>
          <Box position={[0,0,0.04]} size={[0.88,0.88,0.01]} color="#fdf2f8" />
          <Box position={[0,0.05,0.06]} size={[0.28,0.18,0.01]} color="#e9d5ff" />
          <mesh position={[0,0.05,0.07]}>
            <cylinderGeometry args={[0.06,0.06,0.01,8]} />
            <meshStandardMaterial color="#d8b4fe" />
          </mesh>
        </group>
      )}
    </group>
  )
}

// Positions des cadres sur le mur du fond, proportionnelles à `half`
const FRAME_FRACS: Record<number, number[]> = {
  2: [-0.45, 0.1],
  3: [-0.62, -0.08, 0.45],
  4: [-0.68, -0.26, 0.18, 0.62],
}

function getFramePositions(slots: number, half: number): [number,number,number][] {
  const fracs = FRAME_FRACS[Math.min(slots, 4)] ?? FRAME_FRACS[2]
  return fracs.map(f => [half * f, half * 0.65, -half + 0.04] as [number,number,number])
}

// ── Sticker standard (Text) ───────────────────────────────────────────────────

function StickerGlyph({ position, children, color }: { position: [number,number,number]; children: string; color: string }) {
  return (
    <Text position={position} fontSize={0.45} color={color} anchorX="center" anchorY="middle">
      {children}
    </Text>
  )
}

// ── Sticker perso (texture) ───────────────────────────────────────────────────

function CustomStickerTexture({ url }: { url: string }) {
  const texture = useTexture(url)
  return (
    <mesh>
      <planeGeometry args={[0.9, 0.9]} />
      <meshStandardMaterial map={texture} transparent side={THREE.FrontSide} />
    </mesh>
  )
}

function CustomStickerPlane({ slot, url, half }: { slot: number; url: string; half: number }) {
  const s = half / 4
  const configs: { pos: [number,number,number]; rot: [number,number,number] }[] = [
    { pos: [-(half - 0.05), half * 0.55, 0.5 * s],   rot: [0, Math.PI / 2, 0] },
    { pos: [1.5 * s, half * 0.55, -(half - 0.05)],   rot: [0, 0, 0] },
  ]
  const cfg = configs[slot] ?? configs[0]
  return (
    <group position={cfg.pos} rotation={cfg.rot}>
      <Suspense fallback={null}>
        <CustomStickerTexture url={url} />
      </Suspense>
    </group>
  )
}

// ── Scène principale ──────────────────────────────────────────────────────────

type Props = {
  room: RoomData
  userId: string
  onSavePhoto: (updates: Partial<RoomData>) => void
}

export function RoomScene({ room }: Props) {
  const { objects, wall_color, floor_color, light_ambiance, photos, stickers,
          custom_stickers, photo_slots, room_size_level } = room

  const half    = ROOM_HALF[room_size_level] ?? 4
  const frames  = getFramePositions(photo_slots, half)

  return (
    <>
      <IsometricSetup half={half} />
      <Lighting ambiance={light_ambiance} />

      <RoomShell wallColor={wall_color} floorColor={floor_color} half={half} />
      <Window half={half} />

      {objects.includes('bed')       && <Bed half={half} />}
      {objects.includes('desk')      && <Desk half={half} />}
      {objects.includes('bookshelf') && <Bookshelf half={half} />}
      {objects.includes('plant')     && <Plant half={half} />}
      {objects.includes('rug')       && <Rug half={half} />}
      {objects.includes('lamp')      && <Lamp half={half} />}

      {/* Cadres photos */}
      {frames.map((pos, i) => (
        <PhotoFrame key={i} position={pos} photoUrl={photos.find(p => p.slot === i)?.url} />
      ))}

      {/* Stickers prédéfinis */}
      {stickers.includes('heart')   && <StickerGlyph position={[-half*0.83, half*0.77, -(half*0.97)]} color="#ec4899">♥</StickerGlyph>}
      {stickers.includes('star')    && <StickerGlyph position={[-half*0.93, half*0.62, 0.1]}           color="#fbbf24">★</StickerGlyph>}
      {stickers.includes('moon')    && <StickerGlyph position={[ half*0.8,  half*0.77, -(half*0.97)]} color="#c084fc">☽</StickerGlyph>}
      {stickers.includes('flowers') && <StickerGlyph position={[-half*0.97, half*0.45, 0.05]}          color="#fb7185">✿</StickerGlyph>}

      {/* Stickers perso dessinés */}
      {custom_stickers.map(s => (
        <CustomStickerPlane key={s.slot} slot={s.slot} url={s.url} half={half} />
      ))}
    </>
  )
}
