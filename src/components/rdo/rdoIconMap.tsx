import React from 'react'
import Activity from 'lucide-react/dist/esm/icons/activity.js'
import Wrench from 'lucide-react/dist/esm/icons/wrench.js'
import Hammer from 'lucide-react/dist/esm/icons/hammer.js'
import Scissors from 'lucide-react/dist/esm/icons/scissors.js'
import Leaf from 'lucide-react/dist/esm/icons/leaf.js'
import Sprout from 'lucide-react/dist/esm/icons/sprout.js'
import TreePine from 'lucide-react/dist/esm/icons/tree-pine.js'
import Flower2 from 'lucide-react/dist/esm/icons/flower-2.js'
import Droplets from 'lucide-react/dist/esm/icons/droplets.js'
import Waves from 'lucide-react/dist/esm/icons/waves.js'
import Mountain from 'lucide-react/dist/esm/icons/mountain.js'
import HardHat from 'lucide-react/dist/esm/icons/hard-hat.js'
import Truck from 'lucide-react/dist/esm/icons/truck.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import Box from 'lucide-react/dist/esm/icons/box.js'
import Ruler from 'lucide-react/dist/esm/icons/ruler.js'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.js'
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2.js'
import Move from 'lucide-react/dist/esm/icons/move.js'
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw.js'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import Flame from 'lucide-react/dist/esm/icons/flame.js'
import Droplet from 'lucide-react/dist/esm/icons/droplet.js'
import CloudRain from 'lucide-react/dist/esm/icons/cloud-rain.js'
import Thermometer from 'lucide-react/dist/esm/icons/thermometer.js'
import Sun from 'lucide-react/dist/esm/icons/sun.js'
import Moon from 'lucide-react/dist/esm/icons/moon.js'
import Star from 'lucide-react/dist/esm/icons/star.js'
import Heart from 'lucide-react/dist/esm/icons/heart.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js'
import Circle from 'lucide-react/dist/esm/icons/circle.js'
import Square from 'lucide-react/dist/esm/icons/square.js'
import Triangle from 'lucide-react/dist/esm/icons/triangle.js'
import Hexagon from 'lucide-react/dist/esm/icons/hexagon.js'
import Octagon from 'lucide-react/dist/esm/icons/octagon.js'
import Target from 'lucide-react/dist/esm/icons/target.js'
import Crosshair from 'lucide-react/dist/esm/icons/crosshair.js'
import Compass from 'lucide-react/dist/esm/icons/compass.js'
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js'
import Map from 'lucide-react/dist/esm/icons/map.js'
import Globe from 'lucide-react/dist/esm/icons/globe.js'
import Navigation from 'lucide-react/dist/esm/icons/navigation.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.js'
import UserCheck from 'lucide-react/dist/esm/icons/user-check.js'
import Clipboard from 'lucide-react/dist/esm/icons/clipboard.js'
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Folder from 'lucide-react/dist/esm/icons/folder.js'
import Archive from 'lucide-react/dist/esm/icons/archive.js'
import Tag from 'lucide-react/dist/esm/icons/tag.js'
import Flag from 'lucide-react/dist/esm/icons/flag.js'
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import Info from 'lucide-react/dist/esm/icons/info.js'
import HelpCircle from 'lucide-react/dist/esm/icons/circle-help.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import Filter from 'lucide-react/dist/esm/icons/funnel.js'
import Sliders from 'lucide-react/dist/esm/icons/sliders.js'
import Settings from 'lucide-react/dist/esm/icons/settings.js'
import Hash from 'lucide-react/dist/esm/icons/hash.js'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import Building2 from 'lucide-react/dist/esm/icons/building-2.js'

const RDO_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Activity,
  Wrench,
  Hammer,
  Scissors,
  Leaf,
  Sprout,
  TreePine,
  Flower2,
  Droplets,
  Waves,
  Mountain,
  HardHat,
  Truck,
  Package,
  Box,
  Ruler,
  Maximize2,
  Minimize2,
  Move,
  RotateCw,
  Zap,
  Flame,
  Droplet,
  CloudRain,
  Thermometer,
  Sun,
  Moon,
  Star,
  Heart,
  CheckCircle2,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Octagon,
  Target,
  Crosshair,
  Compass,
  MapPin,
  Map,
  Globe,
  Navigation,
  Users,
  User,
  UserPlus,
  UserCheck,
  Clipboard,
  ClipboardCheck,
  FileText,
  Folder,
  Archive,
  Tag,
  Flag,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  Search,
  Filter,
  Sliders,
  Settings,
  Hash,
  Eye,
  Check,
  Building2,
  Shovel: Wrench,
  Pickaxe: Hammer,
}

export function getRdoIcon(name?: string): React.ComponentType<any> {
  if (!name) return Activity
  const clean = name.trim()
  return RDO_ICON_MAP[clean] || Activity
}
