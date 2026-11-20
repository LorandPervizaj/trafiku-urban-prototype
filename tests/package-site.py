"""Package only production assets. Run from any directory; no third-party packages."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'dist'
out.mkdir(exist_ok=True)
shutil.copy2(root/'index.html',out/'index.html')
shutil.copytree(root/'assets',out/'assets',dirs_exist_ok=True)
(out/'data').mkdir(exist_ok=True)
for name in ['lines.json','stops.geojson','routes.geojson']:
 shutil.copy2(root/'data'/name,out/'data'/name)
(out/'.nojekyll').touch()
print('Static site packaged in',out)
