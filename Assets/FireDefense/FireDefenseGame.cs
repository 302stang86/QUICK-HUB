using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace FDEC.Game
{
    // Native Unity prototype. All artwork is generated; no third-party game assets.
    public sealed class FireDefenseGame : MonoBehaviour
    {
        [Header("Tuning")]
        [Min(1)] public int startingHealth = 6;
        [Min(1)] public float moveSpeed = 3.6f;
        [Min(.05f)] public float hoseInterval = .22f;
        [Min(1)] public int maxRooms = 30;
        public Vector2 roomSize = new Vector2(12, 9);
        [Serializable] public class Profile
        {
            public int credits, nozzle, foam, cannon, revision;
            public string nickname = "Firefighter";
        }
        [Serializable] public class SaveRequest
        {
            public int credits, nozzle, foam, cannon, revision, room, score, elapsedMs;
            public string nickname, saveId;
        }
        [Serializable] public class Reply { public bool ok; public string message; public int revision; }
        sealed class Enemy { public Vector2 p; public float hp, speed, timer; public bool charger; public Transform view; }
        sealed class Drop { public Vector2 p, velocity; public float damage, life; public Transform view; }
        sealed class Effect { public Transform view; public float life, maxLife; }
        readonly List<Enemy> enemies = new List<Enemy>();
        readonly List<Drop> drops = new List<Drop>();
        readonly List<Effect> effects = new List<Effect>();
        readonly List<UnityEngine.Object> generated = new List<UnityEngine.Object>();
        Profile profile = new Profile();
        Camera cam;
        Transform hero, nozzleView;
        Sprite circle, square;
        Vector2 position, dragStart, dragNow;
        float shootTimer, grace, runTime, specialCooldown;
        int health, room = 1, score, cleared, charges, pointerId = -1;
        bool ready, playing, paused, dragging, between, defeated, won, saving;
        string status = "Loading employee profile…", pendingJson;
        float retryAt;
        Rect safe;
        float uiScale;
        bool IsWeb
        {
            get {
#if UNITY_WEBGL && !UNITY_EDITOR
                return true;
#else
                return false;
#endif
            }
        }
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void FDEC_Ready();
        [DllImport("__Internal")] static extern void FDEC_Save(string json);
        [DllImport("__Internal")] static extern void FDEC_Board();
#endif
        void Start()
        {
            gameObject.name = "FireDefenseGame";
            circle = MakeCircle();
            square = Sprite.Create(Texture2D.whiteTexture, new Rect(0,0,1,1), new Vector2(.5f,.5f), 1);
            generated.Add(square);
            cam = new GameObject("Fire Defense Camera", typeof(Camera)).GetComponent<Camera>();
            cam.transform.SetParent(transform); cam.transform.position = new Vector3(0,0,-20);
            cam.orthographic = true; cam.depth = 20;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(.035f,.065f,.12f);
            BuildRoom(); hero = BuildHero();
#if UNITY_WEBGL && !UNITY_EDITOR
            FDEC_Ready();
#else
            string local = PlayerPrefs.GetString("FDEC_EditorProfile_v1", "");
            if (local.Length > 0) { try { profile = JsonUtility.FromJson<Profile>(local); } catch { profile = new Profile(); } }
            ready = true; ApplyEquipmentColor(); status = "Local test mode — cloud saving is available in the web build.";
#endif
        }
        Sprite MakeCircle()
        {
            var t = new Texture2D(64,64,TextureFormat.RGBA32,false);
            for(int y=0;y<64;y++) for(int x=0;x<64;x++)
                t.SetPixel(x,y,new Color(1,1,1,Mathf.Clamp01(32-Vector2.Distance(new Vector2(x+.5f,y+.5f),new Vector2(32,32)))));
            t.Apply(); generated.Add(t);
            var sprite = Sprite.Create(t,new Rect(0,0,64,64),new Vector2(.5f,.5f),64);
            generated.Add(sprite); return sprite;
        }
        static Color Hex(string value) { Color c; ColorUtility.TryParseHtmlString(value,out c); return c; }
        Transform Shape(string label, Transform parent, Vector2 at, Vector2 size, string color, int order, bool round=false)
        {
            var go = new GameObject(label,typeof(SpriteRenderer)); go.transform.SetParent(parent,false);
            go.transform.localPosition = at; go.transform.localScale = new Vector3(size.x,size.y,1);
            var r = go.GetComponent<SpriteRenderer>(); r.sprite = round ? circle : square; r.color = Hex(color); r.sortingOrder = order;
            return go.transform;
        }
        // Logical room coordinates project to isometric screen/world coordinates.
        Vector2 Iso(Vector2 p) { return new Vector2((p.x-p.y)*.72f,(p.x+p.y)*.36f); }
        Vector2 FromScreenDirection(Vector2 p) { return new Vector2(p.x/1.44f+p.y/.72f,-p.x/1.44f+p.y/.72f).normalized; }
        void BuildRoom()
        {
            for(int x=0;x<(int)roomSize.x;x++) for(int y=0;y<(int)roomSize.y;y++)
            {
                Vector2 at=Iso(new Vector2(x+.5f-roomSize.x/2,y+.5f-roomSize.y/2));
                var tile=Shape("Warehouse tile",transform,at,new Vector2(1.01f,1.01f),(x+y)%2==0?"#41536A":"#394B62",-100);
                var mesh=tile.GetComponent<SpriteRenderer>(); mesh.sprite=Diamond();
                tile.localScale=new Vector3(1.42f,.70f,1);
            }
            // Decorative pallets sit beyond the playable edges and do not block movement.
            for(int i=0;i<5;i++)
            {
                Vector2 at=Iso(new Vector2(-roomSize.x/2-.7f,-roomSize.y/2+i*1.7f));
                Shape("Storage pallet",transform,at,new Vector2(.9f,.65f),"#8A6349",-20);
                Shape("Crate stripe",transform,at+Vector2.up*.1f,new Vector2(.95f,.09f),"#D2AA75",-19);
            }
        }
        Sprite diamond;
        Sprite Diamond()
        {
            if(diamond!=null) return diamond;
            var t=new Texture2D(64,64,TextureFormat.RGBA32,false);
            for(int y=0;y<64;y++) for(int x=0;x<64;x++)
                t.SetPixel(x,y,new Color(1,1,1,Mathf.Abs(x-31.5f)+Mathf.Abs(y-31.5f)<31 ? 1:0));
            t.Apply(); generated.Add(t);
            diamond=Sprite.Create(t,new Rect(0,0,64,64),new Vector2(.5f,.5f),64); generated.Add(diamond); return diamond;
        }
        Transform BuildHero()
        {
            var root=new GameObject("Firefighter").transform; root.SetParent(transform);
            Shape("Shadow",root,new Vector2(0,-.05f),new Vector2(.65f,.22f),"#182332",0,true);
            Shape("Boot L",root,new Vector2(-.15f,.06f),new Vector2(.19f,.26f),"#152235",1);
            Shape("Boot R",root,new Vector2(.15f,.06f),new Vector2(.19f,.26f),"#152235",1);
            Shape("Turnout coat",root,new Vector2(0,.38f),new Vector2(.53f,.51f),"#DDB76F",2,true);
            Shape("Reflective belt",root,new Vector2(0,.28f),new Vector2(.54f,.08f),"#EAFE78",3);
            Shape("Air tank",root,new Vector2(-.25f,.45f),new Vector2(.15f,.4f),"#B7C8D9",3,true);
            Shape("Face",root,new Vector2(0,.72f),new Vector2(.31f,.28f),"#DEB491",3,true);
            Shape("Visor",root,new Vector2(.05f,.74f),new Vector2(.27f,.12f),"#182D47",4);
            Shape("Helmet",root,new Vector2(0,.88f),new Vector2(.49f,.23f),"#E63842",4,true);
            Shape("Helmet brim",root,new Vector2(0,.81f),new Vector2(.58f,.08f),"#F85254",5);
            nozzleView=Shape("Nozzle",root,new Vector2(.36f,.40f),new Vector2(.37f,.11f),"#67D8FB",4);
            return root;
        }
        void Sort(Transform root,Vector2 logical)
        {
            root.position=Iso(logical);
            int baseOrder=1000-Mathf.RoundToInt(Iso(logical).y*50);
            var renderers=root.GetComponentsInChildren<SpriteRenderer>();
            // Cache local order in each renderer name on its first sort.
            foreach(var r in renderers)
            {
                string[] parts=r.name.Split('|'); int offset;
                if(parts.Length==1) { offset=r.sortingOrder; r.name += "|"+offset; }
                else int.TryParse(parts[parts.Length-1],out offset);
                r.sortingOrder=baseOrder+offset;
            }
        }
        public void OnCloudProfile(string json)
        {
            try { profile=JsonUtility.FromJson<Profile>(json); ready=true; ApplyEquipmentColor(); status="Employee profile connected."; }
            catch { status="Profile could not be loaded. Reload the page."; }
        }
        public void OnCloudBlocked(string message) { ready=false; paused=true; dragging=false; status=message; }
        public void OnCloudSaved(string json)
        {
            var result=JsonUtility.FromJson<Reply>(json); saving=false;
            if(result.ok) { profile.revision=result.revision; pendingJson=null; status="Progress saved."; }
            else { status=result.message; retryAt=Time.realtimeSinceStartup+3; }
        }
        void Save()
        {
            if(!IsWeb)
            {
                PlayerPrefs.SetString("FDEC_EditorProfile_v1",JsonUtility.ToJson(profile)); PlayerPrefs.Save(); status="Saved locally (test mode)."; return;
            }
            if(saving || pendingJson!=null) return;
            pendingJson=JsonUtility.ToJson(new SaveRequest {credits=profile.credits,nozzle=profile.nozzle,foam=profile.foam,cannon=profile.cannon,
                revision=profile.revision,nickname=profile.nickname,room=cleared,score=score,elapsedMs=Mathf.Max(1,Mathf.RoundToInt(runTime*1000)),saveId=Guid.NewGuid().ToString("N")});
            SendPending();
        }
        void SendPending()
        {
            saving=true; status="Saving progress…";
#if UNITY_WEBGL && !UNITY_EDITOR
            FDEC_Save(pendingJson);
#endif
        }
        void StartRun()
        {
            ClearCombat(); position=new Vector2(0,-2); health=startingHealth; room=1; cleared=score=0; runTime=0;
            pendingJson=null; shootTimer=grace=specialCooldown=0; defeated=won=paused=false; playing=true; between=false; SpawnRoom();
        }
        void ClearCombat()
        {
            foreach(var e in enemies) Destroy(e.view.gameObject); enemies.Clear();
            foreach(var d in drops) Destroy(d.view.gameObject); drops.Clear();
            foreach(var e in effects) Destroy(e.view.gameObject); effects.Clear();
        }
        void SpawnRoom()
        {
            charges=2+(profile.foam>0?1:0)+(profile.cannon>0?1:0); specialCooldown=0;
            int count=Mathf.Min(26,3+room*2);
            for(int i=0;i<count;i++)
            {
                Vector2 p=Vector2.zero;
                for(int tries=0;tries<40;tries++)
                { p=new Vector2(UnityEngine.Random.Range(-roomSize.x/2+.5f,roomSize.x/2-.5f),UnityEngine.Random.Range(-roomSize.y/2+.5f,roomSize.y/2-.5f)); if(Vector2.Distance(p,position)>3) break; }
                if(Vector2.Distance(p,position)<3) p=new Vector2(position.x>0?-roomSize.x/2+.5f:roomSize.x/2-.5f,roomSize.y/2-.5f);
                bool charger=room>=3 && i%3==0;
                var root=new GameObject(charger?"Flame Charger":"Ember").transform; root.SetParent(transform);
                Shape("Shadow",root,Vector2.zero,new Vector2(.7f,.22f),"#172235",0,true);
                Shape("Flame",root,new Vector2(0,.32f),charger?new Vector2(.7f,.9f):new Vector2(.45f,.65f),charger?"#E93837":"#FF873C",1,true);
                Shape("Flame tip",root,new Vector2(.08f,.7f),new Vector2(.18f,.4f),"#FFC65B",2,true);
                Shape("Core",root,new Vector2(0,.3f),new Vector2(.23f,.35f),"#FFE6A0",2,true);
                Shape("Eye L",root,new Vector2(-.10f,.45f),new Vector2(.06f,.08f),"#371B27",3);
                Shape("Eye R",root,new Vector2(.10f,.45f),new Vector2(.06f,.08f),"#371B27",3);
                var enemy=new Enemy{p=p,hp=(charger?5:3)+room*.35f,speed=(charger?1.0f:.65f)+room*.025f,charger=charger,timer=UnityEngine.Random.Range(0f,3f),view=root};
                Sort(root,p); enemies.Add(enemy);
            }
            Sort(hero,position);
        }
        Vector2 Movement()
        {
            Vector2 move=Vector2.zero, p=Vector2.zero; bool held=false;
#if ENABLE_INPUT_SYSTEM
            var k=Keyboard.current;
            if(k!=null)
            {
                move.x=((k.dKey.isPressed||k.rightArrowKey.isPressed)?1:0)-((k.aKey.isPressed||k.leftArrowKey.isPressed)?1:0);
                move.y=((k.wKey.isPressed||k.upArrowKey.isPressed)?1:0)-((k.sKey.isPressed||k.downArrowKey.isPressed)?1:0);
                if(k.spaceKey.wasPressedThisFrame) Special();
            }
            if(Touchscreen.current!=null)
            {
                if(pointerId<0)
                    foreach(var t in Touchscreen.current.touches)
                        if(t.press.wasPressedThisFrame && IsMoveZone(t.position.ReadValue())) { pointerId=t.touchId.ReadValue(); break; }
                foreach(var t in Touchscreen.current.touches)
                    if(t.touchId.ReadValue()==pointerId && t.press.isPressed) { held=true; p=t.position.ReadValue(); break; }
                if(!held) pointerId=-1;
            }
            if(!held && Mouse.current!=null) { held=Mouse.current.leftButton.isPressed; p=Mouse.current.position.ReadValue(); }
#elif ENABLE_LEGACY_INPUT_MANAGER
            move.x=((Input.GetKey(KeyCode.D)||Input.GetKey(KeyCode.RightArrow))?1:0)-((Input.GetKey(KeyCode.A)||Input.GetKey(KeyCode.LeftArrow))?1:0);
            move.y=((Input.GetKey(KeyCode.W)||Input.GetKey(KeyCode.UpArrow))?1:0)-((Input.GetKey(KeyCode.S)||Input.GetKey(KeyCode.DownArrow))?1:0);
            if(Input.GetKeyDown(KeyCode.Space)) Special();
            if(pointerId<0) foreach(var t in Input.touches) if(t.phase==TouchPhase.Began && IsMoveZone(t.position)) { pointerId=t.fingerId; break; }
            foreach(var t in Input.touches) if(t.fingerId==pointerId && t.phase!=TouchPhase.Ended && t.phase!=TouchPhase.Canceled) {held=true;p=t.position;break;}
            if(!held) {pointerId=-1;held=Input.GetMouseButton(0);p=Input.mousePosition;}
#endif
            if(!held) dragging=false;
            else if(!dragging && IsMoveZone(p)) {dragging=true;dragStart=p;}
            if(dragging) {dragNow=p;Vector2 d=p-dragStart;move=d.magnitude>10*uiScale?d.normalized:Vector2.zero;}
            return move.sqrMagnitude>.001f?FromScreenDirection(move):Vector2.zero;
        }
        bool IsMoveZone(Vector2 p) { return p.x>=safe.x && p.x<safe.x+safe.width*.65f && p.y>safe.y+15*uiScale && p.y<safe.yMax-85*uiScale; }
        void Update()
        {
            safe=Screen.safeArea; uiScale=Mathf.Max(.5f,Mathf.Min(safe.width/1000f,safe.height/560f));
            cam.orthographicSize=Mathf.Max((roomSize.x+roomSize.y)*.18f+1.8f,((roomSize.x+roomSize.y)*.36f+1)/(Screen.width/(float)Mathf.Max(1,Screen.height)));
            if(!ready||!playing||paused||between||defeated||won||Screen.height>Screen.width) {dragging=false;pointerId=-1;return;}
            float dt=Time.deltaTime;runTime+=dt;grace-=dt;shootTimer-=dt;specialCooldown-=dt;
            position+=Movement()*moveSpeed*dt;
            position.x=Mathf.Clamp(position.x,-roomSize.x/2+.4f,roomSize.x/2-.4f);
            position.y=Mathf.Clamp(position.y,-roomSize.y/2+.4f,roomSize.y/2-.4f); Sort(hero,position);
            hero.localScale=Vector3.one*(grace>0?1+Mathf.Sin(Time.time*30)*.04f:1);
            if(shootTimer<=0 && enemies.Count>0)
            {
                var nearest=enemies[0];foreach(var e in enemies) if((e.p-position).sqrMagnitude<(nearest.p-position).sqrMagnitude) nearest=e;
                var d=new Drop{p=position,velocity=(nearest.p-position).normalized*13,damage=1+profile.nozzle*.35f,life=2};
                d.view=Shape("Hose water",transform,Iso(position),new Vector2(.15f+profile.nozzle*.02f,.15f),"#7AE4FF",0,true);
                drops.Add(d);shootTimer=hoseInterval/(1+profile.nozzle*.06f);
            }
            for(int i=drops.Count-1;i>=0;i--)
            {
                var d=drops[i];Vector2 old=d.p;d.p+=d.velocity*dt;d.life-=dt;Enemy hit=null;float first=float.PositiveInfinity;
                foreach(var e in enemies)
                {
                    Vector2 seg=d.p-old,off=old-e.p;float a=seg.sqrMagnitude,b=2*Vector2.Dot(off,seg),c=off.sqrMagnitude-.28f;
                    float det=b*b-4*a*c;float t=c<=0?0:(a>0&&det>=0?(-b-Mathf.Sqrt(det))/(2*a):-1);
                    if(t>=0&&t<=1&&t<first){hit=e;first=t;}
                }
                if(hit!=null) { Damage(hit,d.damage);d.life=0; }
                if(d.life<=0) {Destroy(d.view.gameObject);drops.RemoveAt(i);} else Sort(d.view,d.p);
            }
            foreach(var e in enemies)
            {
                e.timer+=dt;float burst=e.charger&&e.timer%3.2f>2.6f?2.8f:1;
                e.p=Vector2.MoveTowards(e.p,position,e.speed*burst*dt);Sort(e.view,e.p);
                if(grace<=0&&Vector2.Distance(e.p,position)<.65f) {health--;grace=1;if(health<=0){defeated=true;Save();break;}}
            }
            for(int i=effects.Count-1;i>=0;i--) {var e=effects[i];e.life-=dt;e.view.localScale=Vector3.one*(1-e.life/e.maxLife)*1.4f;if(e.life<=0){Destroy(e.view.gameObject);effects.RemoveAt(i);}}
            if(enemies.Count==0&&!defeated)
            {cleared=room;profile.credits+=25+room*5;between=true;won=room>=maxRooms;ClearCombat();Save();}
        }
        void Damage(Enemy e,float amount)
        {
            e.hp-=amount;
            var v=Shape("Water impact",transform,Iso(e.p)+Vector2.up*.3f,new Vector2(.25f,.25f),"#B4F1FF",2000,true);
            effects.Add(new Effect{view=v,life=.18f,maxLife=.18f});
            if(e.hp<=0){Destroy(e.view.gameObject);enemies.Remove(e);score+=e.charger?200:100;profile.credits+=e.charger?8:5;}
        }
        void Special()
        {
            if(!ready||paused||between||defeated||!playing||charges<=0||specialCooldown>0) return;
            if(profile.foam==0&&profile.cannon==0) return;
            charges--;specialCooldown=5;
            float radius=profile.cannon>0?4.5f:3.2f;
            foreach(var e in enemies.ToArray()) if(Vector2.Distance(e.p,position)<=radius) Damage(e,3+profile.foam*2+profile.cannon*3);
            status=profile.cannon>0?"Water cannon blast!":"Foam burst!";
        }
        void ApplyEquipmentColor()
        {
            if(nozzleView!=null) nozzleView.GetComponent<SpriteRenderer>().color=profile.cannon>0?Hex("#FFD35E"):profile.foam>0?Hex("#A8FFD1"):Hex("#67D8FB");
        }
        void Buy(int item)
        {
            if(saving||pendingJson!=null) return;
            int level=item==0?profile.nozzle:item==1?profile.foam:profile.cannon;
            int cap=item==0?5:3,cost=(item+1)*100*(level+1);
            if(level>=cap||profile.credits<cost) return;
            profile.credits-=cost;if(item==0)profile.nozzle++;else if(item==1)profile.foam++;else profile.cannon++;
            ApplyEquipmentColor();
            Save();
        }
        void OnGUI()
        {
            if(cam==null)return;
            GUI.matrix=Matrix4x4.TRS(new Vector3(safe.x,Screen.height-safe.yMax,0),Quaternion.identity,Vector3.one*uiScale);
            float w=safe.width/uiScale,h=safe.height/uiScale;
            var title=new GUIStyle(GUI.skin.label){fontSize=23,fontStyle=FontStyle.Bold};
            var small=new GUIStyle(GUI.skin.label){fontSize=15,wordWrap=true};
            GUI.Label(new Rect(20,10,w-180,35),"FIRE DEFENSE  /  WAREHOUSE",title);
            GUI.Label(new Rect(20,47,w-150,35),"Room "+room+"   Health "+health+"   Score "+score+"   Credits "+profile.credits,small);
            if(playing&&!defeated&&!won&&!between&&GUI.Button(new Rect(w-115,15,95,45),paused?"Resume":"Pause"))paused=!paused;
            GUI.Label(new Rect(20,h-38,w-220,35),status,small);
            if(!ready) GUI.Box(new Rect(w/2-230,h/2-50,460,100),status);
            else if(!playing||between||defeated||won||paused)
            {
                float x=w/2-240,y=h/2-160;
                GUI.Box(new Rect(x,y,480,310),"");
                GUI.Label(new Rect(x+20,y+15,440,35),won?"WAREHOUSE SECURED":defeated?"RUN ENDED":between?"ROOM CLEARED":paused?"PAUSED":"READY FOR RESPONSE",title);
                GUI.Label(new Rect(x+20,y+55,440,40),profile.nickname+" • "+profile.credits+" credits • Best runs saved online",small);
                bool shop=!playing||between||defeated||won;
                GUI.enabled=!saving&&pendingJson==null;
                if(shop)
                {
                    string[] names={"Nozzle","Foam","Water cannon"};int[] levels={profile.nozzle,profile.foam,profile.cannon};
                    for(int i=0;i<3;i++)
                    {
                        int cap=i==0?5:3,cost=(i+1)*100*(levels[i]+1);
                        bool enabled=GUI.enabled;GUI.enabled=enabled&&levels[i]<cap&&profile.credits>=cost;
                        if(GUI.Button(new Rect(x+20,y+100+i*35,440,31),names[i]+" Lv."+levels[i]+(levels[i]>=cap?" MAX":" — "+cost+" credits")))Buy(i);
                        GUI.enabled=enabled;
                    }
                }
                if(GUI.Button(new Rect(x+20,y+220,280,50),paused?"Resume":between&&!won?"Next room":"Start new run"))
                {
                    if(paused)paused=false;
                    else if(between&&!won){room++;between=false;position=new Vector2(0,-2);SpawnRoom();}
                    else StartRun();
                }
                if(GUI.Button(new Rect(x+315,y+220,145,50),"Leaderboard"))
                {
#if UNITY_WEBGL && !UNITY_EDITOR
                    FDEC_Board();
#else
                    status="Leaderboard is available in the employee web build.";
#endif
                }
                GUI.enabled=true;
                if(pendingJson!=null&&!saving&&Time.realtimeSinceStartup>=retryAt&&GUI.Button(new Rect(x+20,y+275,440,30),"Retry save"))SendPending();
            }
            else
            {
                GUI.Label(new Rect(20,h-75,500,30),"Drag left side / WASD to move • Hose auto-aims while moving",small);
                GUI.enabled=charges>0&&specialCooldown<=0&&(profile.foam>0||profile.cannon>0);
                if(GUI.Button(new Rect(w-175,h-100,155,65),"Special ("+charges+")\n"+(specialCooldown>0?Mathf.CeilToInt(specialCooldown)+"s":"Space / tap")))Special();
                GUI.enabled=true;
            }
            if(Screen.height>Screen.width) GUI.Box(new Rect(0,0,w,h),"Rotate your device to landscape to play.");
            GUI.matrix=Matrix4x4.identity;
            if(dragging){GUI.Box(new Rect(dragStart.x-30,Screen.height-dragStart.y-30,60,60),"");Vector2 p=dragStart+Vector2.ClampMagnitude(dragNow-dragStart,45);GUI.Box(new Rect(p.x-12,Screen.height-p.y-12,24,24),"");}
        }
        void OnApplicationFocus(bool focus){if(!focus){paused=playing;dragging=false;pointerId=-1;}}
        void OnApplicationPause(bool suspend){if(suspend){paused=playing;dragging=false;pointerId=-1;}}
        void OnDestroy(){foreach(var o in generated)if(o!=null)Destroy(o);}
    }
}
