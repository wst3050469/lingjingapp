package com.zhejiangjinmo.lingjing.di

import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton
    fun provideApi(): LingJingApi = LingJingApi()
}
