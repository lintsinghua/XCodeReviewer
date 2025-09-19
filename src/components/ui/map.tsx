/**
 * 百度地图GL组件
 * 
 * 基于百度地图WebGL API封装的React地图组件，支持自定义标记点、缩放级别等配置
 * 
 * 使用示例：
 * <Map
 *   ak="OeTpXHgdUrRT2pPyAPRL7pog6GlMlQzl" // 百度地图API密钥
 *   option={{
 *       address: "山东省威海市环翠区刘公岛景区内",
 *       lat: 37.51029432858647, // 纬度
 *       lng: 122.19726116385918, // 经度
 *       zoom: 12, // 缩放级别
 *   }}
 *   className="w-[600px] h-[300px] rounded-lg" // 容器样式
 * >
 *   <MapTitle className="text-md"/> // 可选标题组件
 * </Map>
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";

/** 地图上下文属性 */
type MapContextProps = {
// 地址
address?: string; /** 地图标记点地址 */
};

const MapContext = createContext<MapContextProps | null>(null);

/** 默认地图配置 */
const defaultOption = {
zoom: 15, /** 默认缩放级别 */
lng: 116.404, /** 默认经度(北京天安门) */
lat: 39.915, /** 默认纬度(北京天安门) */
address: "北京市东城区长安街", /** 默认地址 */
};

const loadScript = (src: string) => {
return new Promise<void>((ok, fail) => {
    const script = document.createElement("script");
    script.onerror = (reason) => fail(reason);

    if (~src.indexOf("{{callback}}")) {
    const callbackFn = `loadscriptcallback_${(+new Date()).toString(36)}`;
    (window as any)[callbackFn] = () => {
        ok();
        delete (window as any)[callbackFn];
    };
    src = src.replace("{{callback}}", callbackFn);
    } else {
    script.onload = () => ok();
    }

    script.src = src;
    document.head.appendChild(script);
});
};

const useMap = () => {
const context = useContext(MapContext);

if (!context) {
    return {};
}

return context;
};

/**
 * 地图标题组件
 * @param {string} className - 自定义类名
 */
const MapTitle = ({ className }: React.ComponentProps<"div">) => {
const { address } = useMap();
if (!address) return null;
return <span className={`text-lg font-bold ${className}`}>{address}</span>;
};

// 记录百度地图SDK加载状态
let BMapGLLoadingPromise: Promise<void> | null = null;

/**
 * 百度地图主组件
 * @param {string} ak - 百度地图API密钥，默认为'OeTpXHgdUrRT2pPyAPRL7pog6GlMlQzl'
 * @param {object} option - 地图配置选项
 * @param {number} option.zoom - 地图缩放级别
 * @param {number} option.lng - 经度坐标
 * @param {number} option.lat - 纬度坐标
 * @param {string} option.address - 标记点地址
 * @param {string} className - 容器自定义类名
 * @param {ReactNode} children - 子组件，通常为MapTitle
 */
const Map = ({
ak,
option,
className,
children,
...props
}: React.ComponentProps<"div"> & {
ak: string;
option?: {
    zoom: number;
    lng: number;
    lat: number;
    address: string;
};
}) => {
const mapRef = useRef<HTMLDivElement>(null);
const currentRef = useRef(null);

const _options = useMemo(() => {
    return { ...defaultOption, ...option };
}, [option]);

const contextValue = useMemo<MapContextProps>(
    () => ({
    address: option?.address,
    }),
    [option?.address]
);

const initMap = useCallback(() => {
    if (!mapRef.current) return;

    let map = currentRef.current;

    if (!map) {
    // 创建地图实例
    map = new (window as any).BMapGL.Map(mapRef.current);
    currentRef.current = map;
    }

    // 清除覆盖物
    map.clearOverlays();

    // 设置地图中心点坐标和地图级别
    const center = new (window as any).BMapGL.Point(
    _options?.lng,
    _options?.lat
    );

    map.centerAndZoom(center, _options?.zoom);

    // 添加标注
    const marker = new (window as any).BMapGL.Marker(center);
    map.addOverlay(marker);
}, [_options]);

useEffect(() => {
    // 检查百度地图API是否已加载
    if ((window as any).BMapGL) {
    initMap();
    } else if (BMapGLLoadingPromise) {
    BMapGLLoadingPromise.then(initMap).then(() => {
        BMapGLLoadingPromise = null;
    });
    } else {
    BMapGLLoadingPromise = loadScript(
        `//api.map.baidu.com/api?type=webgl&v=1.0&ak=${ak}&callback={{callback}}`
    );

    BMapGLLoadingPromise.then(initMap).then(() => {
        BMapGLLoadingPromise = null;
    });
    }
}, [ak, initMap]);

useEffect(() => {
    return () => {
    if (currentRef.current) {
        currentRef.current = null;
    }
    };
}, []);

return (
    <MapContext.Provider value={contextValue}>
    <div
        ref={mapRef}
        className={`w-full aspect-[16/9] ${className}`}
        {...props}
    ></div>
    {children}
    </MapContext.Provider>
);
};

export { Map, MapTitle };