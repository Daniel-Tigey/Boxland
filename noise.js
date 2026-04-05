// 简单 Value Noise 用于生成地形
class ValueNoise {
    constructor(seed = 1) {
        this.seed = seed;
        this.p = [];
        for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    }
    hash(x, y) {
        let n = x * 374761393 + y * 668265263;
        n = (n ^ (n >> 13)) ^ this.seed;
        return (n & 255) / 255.0;
    }
    lerp(a, b, t) { return a + (b - a) * t; }
    fade(t) { return t * t * (3 - 2 * t); }
    noise(x, y) {
        let xi = Math.floor(x), yi = Math.floor(y);
        let xf = x - xi,      yf = y - yi;
        let tl = this.hash(xi, yi);
        let tr = this.hash(xi+1, yi);
        let bl = this.hash(xi, yi+1);
        let br = this.hash(xi+1, yi+1);
        let xt = this.lerp(tl, tr, this.fade(xf));
        let xb = this.lerp(bl, br, this.fade(xf));
        return this.lerp(xt, xb, this.fade(yf));
    }
    octaved(x, y, octaves=4, gain=0.5, lacunarity=2.0) {
        let sum = 0, amp = 1.0, freq = 1.0, totalAmp = 0;
        for (let i = 0; i < octaves; i++) {
            sum += this.noise(x * freq, y * freq) * amp;
            totalAmp += amp;
            amp *= gain; freq *= lacunarity;
        }
        return sum / totalAmp;
    }
}
