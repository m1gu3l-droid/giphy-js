import React, { PureComponent, ReactType } from 'react'
import { debounce } from 'throttle-debounce'
import Gif, { EventProps as GifEventProps, GifOverlayProps } from './gif'
import Bricks from 'bricks.js'
import Observer from '../util/observer'
import { IGif, IUser } from '@giphy/js-types'
import { gifPaginator, GifsResult, EventProps as FetchEventProps } from '@giphy/js-fetch-api'
import Loader from './loader'
import FetchError from './fetch-error'

type Props = {
    className?: string
    width: number
    user: Partial<IUser>
    columns: number
    gutter: number
    fetchGifs: (offset: number) => Promise<GifsResult>
    overlay?: ReactType<GifOverlayProps>
} & GifEventProps & FetchEventProps

const defaultProps = Object.freeze({
    columns: 3,
    gutter: 6,
    width: (typeof window !== 'undefined') ? window.innerWidth : 800,
    user: {},
})

type State = {
    gifWidth: number
    isFetching: boolean
    isError: boolean
    gifs: IGif[]
    isLoaderVisible: boolean
    isDoneFetching: boolean
}

const initialState = Object.freeze({
    isFetching: false,
    isError: false,
    gifWidth: 0,
    gifs: [] as IGif[],
    isLoaderVisible: true,
    isDoneFetching: false,
})

class Grid extends PureComponent<Props, State> {
    static className = 'giphy-grid'
    static readonly defaultProps = defaultProps
    readonly state = initialState
    bricks?: any
    el?: HTMLDivElement | null
    paginator: () => Promise<IGif[]>
    static getDerivedStateFromProps({ columns, gutter, width }: Props, prevState: State) {
        const gutterOffset = gutter * (columns - 1)
        const gifWidth = Math.floor((width - gutterOffset) / columns)
        if (prevState.gifWidth !== gifWidth) {
            return { gifWidth }
        }
        return null
    }
    constructor(props: Props) {
        super(props)
        const { fetchGifs, onFetch, onPage } = props
        this.paginator = gifPaginator({ fetchGifs, onFetch, onPage })
    }
    setBricks() {
        const { columns, gutter } = this.props
        // bricks
        this.bricks = Bricks({
            container: this.el!,
            packed: `data-packed-${columns}`,
            sizes: [{ columns, gutter }],
        })
    }
    componentDidMount() {
        this.setBricks()
        this.onFetch()
    }
    componentDidUpdate(prevProps: Props, prevState: State) {
        const { gifs } = this.state
        const { gifWidth } = this.state

        const numberOfOldGifs = prevState.gifs.length
        const numberOfNewGifs = gifs.length

        if (prevState.gifWidth !== gifWidth && numberOfOldGifs > 0) {
            const { columns } = this.props
            if (columns !== prevProps.columns) {
                this.setBricks()
            }
            this.bricks.pack()
        }

        if (prevState.gifs !== gifs) {
            if (numberOfNewGifs > numberOfOldGifs && numberOfOldGifs > 0) {
                // we just added new gifs
                this.bricks.update()
            } else {
                // we changed existing gifs or removed a gif
                this.bricks.pack()
            }
        }
    }
    onLoaderVisible = (isVisible: boolean) => {
        this.setState({ isLoaderVisible: isVisible }, this.onFetch)
    }
    onFetch = debounce(100, async () => {
        const { isFetching, isLoaderVisible, gifs: existingGifs } = this.state
        if (!isFetching && isLoaderVisible) {
            this.setState({ isFetching: true, isError: false })
            let gifs
            try {
                gifs = await this.paginator()
            } catch (error) {
                this.setState({ isFetching: false, isError: true })
                const { onFetchError } = this.props
                if (onFetchError) onFetchError(error)
            }
            if (gifs) {
                // if we've just fetched and we don't have
                // any more gifs, we're done fetching
                if (existingGifs.length === gifs.length) {
                    this.setState({ isDoneFetching: true })
                } else {
                    this.setState({ gifs, isFetching: false })
                    const { onGifsFetched } = this.props
                    if (onGifsFetched) onGifsFetched(gifs)
                    this.onFetch()
                }
            }
        }
    })
    render() {
        const {
            fetchGifs,
            onGifVisible,
            onGifRightClick,
            className = Grid.className,
            onGifHover,
            onGifUnhover,
            onGifSeen,
            onGifClick,
            user,
            overlay,
        } = this.props
        const { gifWidth, gifs, isError, isDoneFetching } = this.state
        const showLoader = fetchGifs && gifs.length > 0 && !isDoneFetching
        return (
            <div className={className}>
                <div ref={c => (this.el = c)}>
                    {gifs.map(gif => (
                        <Gif
                            gif={gif}
                            key={gif.id}
                            width={gifWidth}
                            onGifClick={onGifClick}
                            onGifHover={onGifHover}
                            onGifUnhover={onGifUnhover}
                            onGifSeen={onGifSeen}
                            onGifVisible={onGifVisible}
                            onGifRightClick={onGifRightClick}
                            user={user}
                            overlay={overlay}
                        />
                    ))}
                </div>
                {isError ? (
                    <FetchError onClick={this.onFetch} />
                ) : (
                    showLoader && (
                        <Observer onVisibleChange={this.onLoaderVisible}>
                            <Loader />
                        </Observer>
                    )
                )}
            </div>
        )
    }
}

export default Grid
