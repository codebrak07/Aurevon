import { memo, useState } from 'react';
import usePlayer from '../hooks/usePlayer';
import { searchTracks } from '../services/musicService';
import './HomeGreeting.css';

const quickCards = [
  {
    title: 'Liked Songs',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP1V60DJma372vZpJsPKr5o77SdUJkvy0zVQKM03bgiRxxlvgQ51AIHrrVhajzaO1CpuwGtO2HKX18zuynZNZyfADU9gIHpMqfwR-t88amXwNUMlcERJUZXt-Z4tL6NcFIS71WdJV4zPGTn5qhNj4xGqjWAffa2XO-DUsNxxydcNuJxw0AYRyaIWLPPouZSE1nXeJ0LGxbmYg63gnLtzGbKRIiWQjJ_JBqqp280q21UZDwf7TaqIDOjOGxZ5lAFWaroRM2ued5YrtU',
  },
  {
    title: 'Techno Bunker',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3cLmyfbZyTDmgDCJR9jZT0ABqIq8doePBKXbVjy2gkDvMN1Wd9I9HBvy0UI2JGGPwEIYoGa4uVfR2yYy1J6PWwTvSRERC1ZxjKGbOE117JojLuSZwPa6EkLSYN7802ImlbKQEyOv8gQ_q1Yp21R5gC3Bpsxk042trdjxX5yx7ejDWIQE79MsKnRGBN0fnLsvK8sInmBurUVmn9ibfRit7SmEgJ1UZhx6HF5n0I02uYFeZT0GtCYPKinMz3wPR7hgYVHM-JW5DMt_K',
  },
  {
    title: 'Chill Lofi',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqnIGv_Rpil6Y-NWabt2Y2byL535iE8b1ypdcWmLKSvWBaqp2TIfImcJnYs2DBUFEseka3_fmiymcGextGRcuK4pC11zpqFo4ksFZVsrzgzVrd01QTiphcm41eoB_R1890O5MkbFmqm47NxcJ80vUNgcTAHxZemwMTs751lC7WIiY2xfAk74RgVN24sWUCko2q9ASWFLrdyqytg7x4ZtLC3RgNniT7ZhypJFUiDrPL0CiNqnrQY2g4-MwuLA6oJ5FGCM53OddC6hLL',
  },
  {
    title: 'Daily Mix 1',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNVyXSD3YMUDGq0Ks2cdSDUVNeVffKmo_IQos78VOrgtoK8_sC3UwBMRj_4yqkI3MICYMvcmO6CK64s4s5jJI6Mlg3pMh054wgig0X-d5x3i-zMbHA7ZNmwAEsweYwMVj54mdo7oXcHOpaY_DttrlEWqvAYem2bWNVx1XGF1pSP50MQcdhJImLh4Ozo_4IiQ7GgupDLUHEB5MxsmjBSm96lA002f3nSusCdd47Zp7b5-rbHpDKcFz6K0j_hgz3ndS7aeqF9oNpJzSV',
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

const HomeGreeting = memo(function HomeGreeting({ onOpenLibrary }) {
  const { 
    user, 
    likedSongs, 
    playlists, 
    createPlaylist, 
    addToPlaylist, 
    playPlaylist 
  } = usePlayer();
  
  const [loadingCard, setLoadingCard] = useState(null);
  const name = user?.username ? `, ${user.username}` : '';

  const handleCardClick = async (card) => {
    if (loadingCard) return;

    if (card.title === 'Liked Songs') {
      if (onOpenLibrary) onOpenLibrary('liked');
      return;
    }

    const matchedPlaylist = playlists.find(p => p.name.toLowerCase() === card.title.toLowerCase());
    if (matchedPlaylist) {
      if (onOpenLibrary) onOpenLibrary(matchedPlaylist.id);
      return;
    }

    setLoadingCard(card.title);
    try {
      let searchQuery = '';
      if (card.title === 'Techno Bunker') searchQuery = 'techno electronic';
      else if (card.title === 'Chill Lofi') searchQuery = 'chill lofi hip hop';
      else if (card.title === 'Daily Mix 1') searchQuery = 'top hits pop';
      else searchQuery = card.title;

      const tracks = await searchTracks(searchQuery);
      if (tracks && tracks.length > 0) {
        const newPlaylist = createPlaylist(card.title);
        for (const track of tracks.slice(0, 10)) {
          addToPlaylist(newPlaylist.id, track);
        }
        if (onOpenLibrary) onOpenLibrary(newPlaylist.id);
      }
    } catch (error) {
      console.error('Failed to create and populate playlist:', error);
    } finally {
      setLoadingCard(null);
    }
  };

  const handlePlayClick = async (e, card) => {
    e.stopPropagation();
    if (loadingCard) return;

    if (card.title === 'Liked Songs') {
      if (likedSongs && likedSongs.length > 0) {
        playPlaylist(likedSongs);
      }
      return;
    }

    const matchedPlaylist = playlists.find(p => p.name.toLowerCase() === card.title.toLowerCase());
    if (matchedPlaylist && matchedPlaylist.tracks?.length > 0) {
      playPlaylist(matchedPlaylist.tracks);
      return;
    }

    setLoadingCard(card.title);
    try {
      let searchQuery = '';
      if (card.title === 'Techno Bunker') searchQuery = 'techno electronic';
      else if (card.title === 'Chill Lofi') searchQuery = 'chill lofi hip hop';
      else if (card.title === 'Daily Mix 1') searchQuery = 'top hits pop';
      else searchQuery = card.title;

      const tracks = await searchTracks(searchQuery);
      if (tracks && tracks.length > 0) {
        let targetPlaylist = matchedPlaylist;
        if (!targetPlaylist) {
          targetPlaylist = createPlaylist(card.title);
        }
        for (const track of tracks.slice(0, 10)) {
          addToPlaylist(targetPlaylist.id, track);
        }
        playPlaylist(tracks.slice(0, 10));
      }
    } catch (error) {
      console.error('Failed to create/play playlist:', error);
    } finally {
      setLoadingCard(null);
    }
  };

  return (
    <section className="home-greeting">
      <h2 className="home-greeting__title">{getGreeting()}{name}</h2>
      <div className="home-greeting__grid">
        {quickCards.map((card) => (
          <div 
            key={card.title} 
            className={`quick-card group cursor-pointer transition-all active:scale-98 ${loadingCard === card.title ? 'opacity-70 pointer-events-none' : ''}`}
            onClick={() => handleCardClick(card)}
          >
            <div className="quick-card__art">
              <img src={card.image} alt={card.title} loading="lazy" />
            </div>
            <div className="quick-card__body">
              <span className="quick-card__name">{card.title}</span>
              {loadingCard === card.title ? (
                <div className="quick-card__spinner flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 border border-primary/40">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <button 
                  className="quick-card__play" 
                  aria-label={`Play ${card.title}`}
                  onClick={(e) => handlePlayClick(e, card)}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

export default HomeGreeting;

