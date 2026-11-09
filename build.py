# index.html'i src/ dosyalarından üretir. three.js r128 gerekir:
#   npm pack three@0.128.0 && tar xzf three-0.128.0.tgz  (package/build/three.min.js oluşur)
import sys
three_path = sys.argv[1] if len(sys.argv) > 1 else 'package/build/three.min.js'
head = open('src/head.html', encoding='utf-8').read()
three = open(three_path, encoding='utf-8').read()
js = open('src/game.js', encoding='utf-8').read()
out = head + "<script>\n" + three + "\n</script>\n<script>\n" + js + "\n</script>\n</body>\n</html>\n"
open('index.html', 'w', encoding='utf-8').write(out)
print('index.html', len(out), 'bytes')
